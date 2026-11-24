/**
 * 青空文庫の『走れメロス』を取得し、目標文(清音ひらがなの列)を data/target.txt に書き出す。
 *
 *   bun scripts/build-target.ts
 *
 * 手順: 取得(Shift_JIS) → 本文抽出 → ルビを読みに置換 → 注記を除去
 *       → 段落ごとに形態素解析(漢字はルビ優先、無ければ kuromoji の読み)
 *       → ひらがな以外を除去 → 濁点・半濁点・小書き文字を清音へ。
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import kuromoji from "kuromoji";
import { ALPHABET, isSeion, katakanaToHiragana, toSeion } from "../shared/kana.ts";

const SOURCE_URL = "https://www.aozora.gr.jp/cards/000035/files/1567_14913.html";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KANJI = /[㐀-鿿豈-﫿々〆〇ヶ]/;

const res = await fetch(SOURCE_URL);
if (!res.ok) throw new Error(`取得失敗: ${res.status}`);
const html = new TextDecoder("shift_jis", { fatal: true }).decode(await res.arrayBuffer());

// --- 本文の抽出 ---
const start = html.indexOf('<div class="main_text">');
const end = html.indexOf('<div class="bibliographical_information">');
if (start < 0 || end < 0) throw new Error("本文の範囲が見つからない");
let body = html.slice(start, end);

let rubyCount = 0;
body = body.replace(/<ruby><rb>([^<]*)<\/rb>[\s\S]*?<rt>([^<]*)<\/rt>[\s\S]*?<\/ruby>/g, (_m, _base, rt) => {
  rubyCount++;
  return rt;
});
body = body
  .replace(/<span class="notes">[\s\S]*?<\/span>/g, "") // 注記
  .replace(/<img[^>]*class="gaiji"[^>]*>/g, () => {
    throw new Error("外字(gaiji)が含まれている。扱いを決めること");
  })
  .replace(/<br\s*\/?>/g, "\n")
  .replace(/<[^>]+>/g, "")
  .replace(/［＃[^］]*］/g, "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
if (/[《》｜]/.test(body)) throw new Error("ルビ記法が残っている");

// kuromoji が読みを返せない語の補正(ルビが無く、辞書にも無いもの)。形態素解析の前に置き換える。
const MANUAL_READINGS: [string, string][] = [
  ["警吏", "けいり"],
  ["刑吏", "けいり"],
  ["お互さま", "おたがいさま"],
  ["お互い", "おたがい"],
  ["裂目", "さけめ"],
  ["張り裂ける", "はりさける"],
  ["此の", "この"],
  ["一人", "ひとり"],
  ["二人", "ふたり"],
  ["三人", "さんにん"],
  ["三里", "さんり"],
  ["低声", "こごえ"],
];
let manualCount = 0;
for (const [from, to] of MANUAL_READINGS) {
  body = body.replace(new RegExp(from, "g"), () => (manualCount++, to));
}

const paragraphs = body.split("\n").map((p) => p.trim()).filter(Boolean);

// --- 形態素解析 ---
const tokenizer = await new Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>>((ok, ng) => {
  kuromoji.builder({ dicPath: resolve(root, "node_modules/kuromoji/dict") }).build((e, t) => (e ? ng(e) : ok(t)));
});

const readings = new Map<string, string>();
const unknown: string[] = [];
let out = "";
for (const p of paragraphs) {
  for (const t of tokenizer.tokenize(p)) {
    let kana = t.surface_form;
    if (KANJI.test(t.surface_form)) {
      if (!t.reading || t.reading === "*") {
        unknown.push(t.surface_form);
        continue;
      }
      kana = t.reading;
      readings.set(t.surface_form, katakanaToHiragana(t.reading));
    }
    // ひらがな・カタカナだけを残す(カタカナはひらがなにする)。長音ー・記号・空白・英数は除く。
    for (const c of katakanaToHiragana(kana)) if (/[ぁ-ゖ]/.test(c)) out += c;
  }
}
if (unknown.length) throw new Error(`読みの無い漢字語: ${[...new Set(unknown)].join(" ")}`);

// --- 清音化と検査 ---
const target = Array.from(toSeion(out));
const bad = new Set(target.filter((c) => !isSeion(c)));
if (bad.size) throw new Error(`清音46字に収まらない文字: ${[...bad].join(" ")}`);

const text = target.join("");
const sha256 = createHash("sha256").update(text).digest("hex");
mkdirSync(resolve(root, "data"), { recursive: true });
writeFileSync(resolve(root, "data/target.txt"), text + "\n");
writeFileSync(
  resolve(root, "data/target.meta.json"),
  JSON.stringify(
    { source: SOURCE_URL, length: text.length, sha256, rubyCount, manualCount, paragraphs: paragraphs.length, alphabet: ALPHABET.length },
    null,
    2,
  ) + "\n",
);
// 監査用: kuromoji の読みを使った漢字語の一覧
writeFileSync(
  resolve(root, "data/target.readings.tsv"),
  [...readings].map(([k, v]) => `${k}\t${v}`).join("\n") + "\n",
);
console.log(`文字数 ${text.length} / ルビ ${rubyCount} 件 / kuromoji の読み ${readings.size} 語 / sha256 ${sha256.slice(0, 12)}`);

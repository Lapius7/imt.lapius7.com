/**
 * 青空文庫の『走れメロス』の本文を、ルビ付きのまま data/text.json に書き出す(全文ページ用)。
 *
 *   bun scripts/build-text.ts
 *
 * 本文の文字は変えない。<ruby> は [親文字, ルビ] の組にし、行(<br />)ごとに段落へ分ける。
 * 空行は捨てる。行頭の全角空白(字下げ)は残す。地付きの行は right: true にする。
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://www.aozora.gr.jp/cards/000035/files/1567_14913.html";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const res = await fetch(SOURCE_URL);
if (!res.ok) throw new Error(`取得失敗: ${res.status}`);
const html = new TextDecoder("shift_jis", { fatal: true }).decode(await res.arrayBuffer()).replace(/\r/g, "");

const start = html.indexOf('<div class="main_text">');
const end = html.indexOf('<div class="bibliographical_information">');
if (start < 0 || end < 0) throw new Error("本文の範囲が見つからない");
const body = html.slice(start + '<div class="main_text">'.length, end).replace(/<\/div>\s*$/, "");

const decode = (s: string) => s.replace(/\n/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
type Seg = string | [string, string];

type Para = { s: Seg[]; right?: true };
const paragraphs: Para[] = [];
let rubyCount = 0;
for (const raw of body.split(/<br\s*\/?>/)) {
  // 地付き(右寄せ)の行だけ <div class="chitsuki_1"> で囲まれている
  const right = /<div class="chitsuki_1"/.test(raw);
  const line = raw.replace(/<div class="chitsuki_1"[^>]*>/, "").replace(/<\/div>/g, "");
  const segs: Seg[] = [];
  let last = 0;
  const re = /<ruby><rb>([^<]*)<\/rb>[\s\S]*?<rt>([^<]*)<\/rt>[\s\S]*?<\/ruby>/g;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) segs.push(decode(line.slice(last, m.index)));
    segs.push([decode(m[1] ?? ""), decode(m[2] ?? "")]);
    rubyCount++;
    last = m.index + m[0].length;
  }
  if (last < line.length) segs.push(decode(line.slice(last)));
  const plain = segs.map((s) => (typeof s === "string" ? s : s[0])).join("");
  if (/[<>]/.test(plain) || /［＃|《|》/.test(plain)) throw new Error(`想定外の記法が残っている: ${plain.slice(0, 40)}`);
  if (plain.trim() === "") continue;
  paragraphs.push(right ? { s: segs, right: true } : { s: segs });
}

writeFileSync(resolve(root, "data/text.json"), JSON.stringify({ source: SOURCE_URL, paragraphs }) + "\n");
console.log(`段落 ${paragraphs.length} / ルビ ${rubyCount}`);

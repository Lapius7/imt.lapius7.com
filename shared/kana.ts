/** 清音ひらがな 46 文字(ん・を含む)。生成する文字の集合。 */
export const ALPHABET = Array.from(
  "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん",
);

const ALPHABET_SET = new Set(ALPHABET);

const SMALL: Record<string, string> = {
  ぁ: "あ", ぃ: "い", ぅ: "う", ぇ: "え", ぉ: "お",
  ゃ: "や", ゅ: "ゆ", ょ: "よ", っ: "つ", ゎ: "わ",
  ゕ: "か", ゖ: "け",
};

/** カタカナ(ァ〜ヶ、ヴ)をひらがなにする。 */
export function katakanaToHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/**
 * 濁点・半濁点・小書き文字を清音にする。
 * が→か、ぱ→は、っ→つ、ゃ→や、ゔ→う。清音ひらがな以外の文字はそのまま返す。
 */
export function toSeion(s: string): string {
  const decomposed = katakanaToHiragana(s).normalize("NFD").replace(/[゙゚]/g, "");
  let out = "";
  for (const c of decomposed) out += SMALL[c] ?? c;
  return out;
}

export function isSeion(c: string): boolean {
  return ALPHABET_SET.has(c);
}

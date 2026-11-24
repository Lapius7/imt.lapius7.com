/** KMP の失敗関数。fail[i] は target[0..i] の真の接頭辞かつ接尾辞である最長の長さ。 */
export function failureTable(target: readonly string[]): number[] {
  const fail = new Array<number>(target.length).fill(0);
  let k = 0;
  for (let i = 1; i < target.length; i++) {
    while (k > 0 && target[i] !== target[k]) k = fail[k - 1]!;
    if (target[i] === target[k]) k++;
    fail[i] = k;
  }
  return fail;
}

/**
 * 生成列が目標文の先頭から連続して一致している長さを追う。
 * 不一致のときは失敗関数に従って戻す。全文一致(cur === target.length)の後は呼ばない。
 */
export class Matcher {
  readonly fail: number[];
  constructor(readonly target: readonly string[]) {
    if (target.length === 0) throw new Error("目標文が空");
    this.fail = failureTable(target);
  }
  step(cur: number, ch: string): number {
    if (cur >= this.target.length) throw new Error("全文一致の後は step できない");
    while (cur > 0 && this.target[cur] !== ch) cur = this.fail[cur - 1]!;
    return this.target[cur] === ch ? cur + 1 : cur;
  }
}

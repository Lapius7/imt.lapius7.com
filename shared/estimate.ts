import { ALPHABET } from "./kana.ts";

const LOG10_A = Math.log10(ALPHABET.length);
const SECONDS_PER_YEAR = 365.25 * 24 * 3600;

export interface Estimate {
  /** 1 回の試行(連続 N 文字)が全文と一致する確率の常用対数(負) */
  log10PerWindow: number;
  /** ここまでの生成で全文一致が起きている確率の常用対数。N 文字に満たなければ null(確率 0) */
  log10SoFar: number | null;
  /** 全文一致までの期待時間(年)の常用対数。1 秒に 1 文字の場合 */
  log10YearsExpected: number;
}

/**
 * 全文一致の見積もり。目標文の長さ N、一様乱数で 1 文字あたり確率 1/46 とする。
 * 窓 1 つの確率は 46^-N。T 文字生成したときの窓の数は T-N+1 で、確率は和集合の上界(ほぼ等しい)で近似する。
 * 期待時間は 46^N 文字(自己重複による補正は 1 + 1/46 + ... で 2% 程度なので無視)。
 */
export function estimate(targetLen: number, total: number, tickMs = 1000): Estimate {
  const log10PerWindow = -targetLen * LOG10_A;
  const windows = total - targetLen + 1;
  return {
    log10PerWindow,
    log10SoFar: windows >= 1 ? Math.log10(windows) + log10PerWindow : null,
    log10YearsExpected: targetLen * LOG10_A + Math.log10(tickMs / 1000) - Math.log10(SECONDS_PER_YEAR),
  };
}

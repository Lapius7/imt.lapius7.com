import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { ALPHABET, isSeion, toSeion } from "../shared/kana.ts";
import { Matcher, failureTable } from "../shared/matcher.ts";
import { estimate } from "../shared/estimate.ts";
import { Engine, randomKana } from "../server/engine.ts";
import type { State } from "../server/store.ts";

describe("清音化", () => {
  test("濁点・半濁点・小書き文字・ゔ", () => {
    expect(toSeion("がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ")).toBe("かきくけこさしすせそたちつてとはひふへほはひふへほ");
    expect(toSeion("っゃゅょぁぃぅぇぉゎ")).toBe("つやゆよあいうえおわ");
    expect(toSeion("ゔ")).toBe("う");
    expect(toSeion("ヴァ")).toBe("うあ");
    expect(toSeion("ん を")).toBe("ん を");
  });
  test("アルファベットは 46 字で重複なし", () => {
    expect(ALPHABET.length).toBe(46);
    expect(new Set(ALPHABET).size).toBe(46);
  });
  test("同梱の目標文は清音 46 字だけ", () => {
    const t = readFileSync(new URL("../data/target.txt", import.meta.url), "utf8").trim();
    expect(t.length).toBeGreaterThan(10000);
    expect([...t].every(isSeion)).toBe(true);
  });
  test("乱数は 46 字を一様に出す(カイ二乗の緩い検査)", () => {
    const n = 46_000;
    const count = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      const c = randomKana();
      count.set(c, (count.get(c) ?? 0) + 1);
    }
    expect(count.size).toBe(46);
    for (const v of count.values()) expect(Math.abs(v - 1000)).toBeLessThan(200); // 期待 1000、標準偏差約 31
  });
});

/** 力任せ: 列 s を食べた直後の「target の接頭辞と一致する最長の接尾辞」の長さ */
function brute(target: string[], s: string[]): number {
  for (let k = Math.min(target.length, s.length); k > 0; k--) {
    if (s.slice(s.length - k).every((c, i) => c === target[i])) return k;
  }
  return 0;
}

describe("KMP", () => {
  test("失敗関数", () => {
    expect(failureTable([..."ababaca"])).toEqual([0, 0, 1, 2, 3, 0, 1]);
  });
  test("小さな文字集合のランダム列で力任せと一致する", () => {
    let seed = 12345;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n);
    for (let round = 0; round < 300; round++) {
      const target = Array.from({ length: 1 + rnd(8) }, () => "ab"[rnd(2)]!);
      const m = new Matcher(target);
      let cur = 0;
      const seen: string[] = [];
      for (let i = 0; i < 200 && cur < target.length; i++) {
        const ch = "ab"[rnd(2)]!;
        seen.push(ch);
        cur = m.step(cur, ch);
        expect(cur).toBe(brute(target, seen));
      }
    }
  });
});

describe("見積もり", () => {
  test("46^-N と期待年数", () => {
    const e = estimate(10685, 0);
    expect(e.log10PerWindow).toBeCloseTo(-10685 * Math.log10(46), 6);
    expect(e.log10SoFar).toBeNull();
    expect(estimate(2, 3).log10SoFar).toBeCloseTo(Math.log10(2) - 2 * Math.log10(46), 9);
  });
});

describe("Engine", () => {
  const mem = () => {
    const rows: { id: number; ch: string }[] = [];
    let last: State | null = null;
    let fail = false;
    return {
      rows,
      get last() {
        return last;
      },
      setFail: (v: boolean) => (fail = v),
      store: {
        async commitTick(row: { id: number; ch: string }, s: State) {
          if (fail) throw new Error("db down");
          rows.push(row);
          last = s;
        },
      },
    };
  };
  const init: State = { total: 0, cur: 0, best: 0, bestAt: null, startedAt: 0, completedAt: null };

  test("短い目標文で全文一致し、完了状態になる", async () => {
    const m = mem();
    const seq = [..."ああいうあいうう"]; // 目標 "あいう": あ→あ(1)→い(2)…の流れ。"ああい…" で戻りを通る
    let i = 0;
    const e = new Engine({ target: [..."あいう"], state: init, store: m.store, tickMs: 1000, rng: () => seq[i++]!, now: () => 1000 + i });
    const curs: number[] = [];
    for (let k = 0; k < 6; k++) {
      await e.tick();
      curs.push(e.state.cur);
      if (e.completed) break;
    }
    expect(curs).toEqual([1, 1, 2, 3]); // あ, あ(戻って 1), い, う
    expect(e.completed).toBe(true);
    expect(e.state.completedAt).not.toBeNull();
    expect(e.state.best).toBe(3);
    expect(e.state.total).toBe(4);
    expect(m.last?.completedAt).toBe(e.state.completedAt);
  });

  test("保存に失敗した文字は数えない", async () => {
    const m = mem();
    const e = new Engine({ target: [..."あいう"], state: init, store: m.store, tickMs: 1000, rng: () => "あ", onError: () => {} });
    m.setFail(true);
    await e.tick();
    expect(e.state.total).toBe(0);
    m.setFail(false);
    await e.tick();
    expect(e.state.total).toBe(1);
    expect(m.rows.length).toBe(1);
  });

  test("最長一致は更新した時だけ bestAt が変わる", async () => {
    const m = mem();
    const seq = [..."あいあ"];
    let i = 0;
    let t = 0;
    const e = new Engine({ target: [..."あいう"], state: init, store: m.store, tickMs: 1000, rng: () => seq[i++]!, now: () => ++t * 100 });
    await e.tick(); // あ → best1 at 100
    await e.tick(); // い → best2 at 200
    await e.tick(); // あ → cur1, best 2 のまま
    expect(e.state.best).toBe(2);
    expect(e.state.bestAt).toBe(200);
    expect(e.state.cur).toBe(1);
  });
});

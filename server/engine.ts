import { ALPHABET } from "../shared/kana.ts";
import { Matcher } from "../shared/matcher.ts";
import type { CharRow, State } from "./store.ts";

export interface TickStore {
  commitTick(row: CharRow, s: State): Promise<void>;
}

export interface TickEvent {
  row: CharRow;
  state: State;
}

/** 清音ひらがな 46 文字からの一様乱数(剰余の偏りが出ないよう棄却サンプリング)。 */
export function randomKana(): string {
  const n = ALPHABET.length;
  const limit = 256 - (256 % n);
  const buf = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0]! < limit) return ALPHABET[buf[0]! % n]!;
  }
}

export const RECENT_IN_MEMORY = 300;

/** 生成ループ。1 tickMs ごとに 1 文字を生成し、保存に成功した分だけ数える。 */
export class Engine {
  state: State;
  readonly recent: CharRow[] = [];
  private listeners = new Set<(e: TickEvent) => void>();
  private matcher: Matcher;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private inflight: Promise<void> = Promise.resolve();
  private nextAt = 0;

  constructor(
    private opts: {
      target: readonly string[];
      state: State;
      store: TickStore;
      tickMs: number;
      rng?: () => string;
      now?: () => number;
      onError?: (e: unknown) => void;
    },
  ) {
    this.matcher = new Matcher(opts.target);
    this.state = opts.state;
  }

  subscribe(fn: (e: TickEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  seedRecent(rows: CharRow[]) {
    this.recent.length = 0;
    this.recent.push(...rows);
  }

  get completed(): boolean {
    return this.state.completedAt !== null;
  }

  start() {
    if (this.running || this.completed) return;
    this.running = true;
    this.nextAt = this.now() + this.opts.tickMs;
    this.schedule();
  }

  async stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    await this.inflight;
  }

  private now() {
    return (this.opts.now ?? Date.now)();
  }

  private schedule() {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      this.inflight = this.tick().finally(() => {
        // 遅れても追いつくための連続生成はしない(数えるのは実際に生成した分だけ)
        this.nextAt += this.opts.tickMs;
        if (this.nextAt <= this.now()) this.nextAt = this.now() + this.opts.tickMs;
        if (this.completed) this.running = false;
        this.schedule();
      });
    }, Math.max(0, this.nextAt - this.now()));
  }

  /** 1 文字ぶん進める。保存に失敗したときは状態を進めない。 */
  async tick(): Promise<void> {
    const prev = this.state;
    const ts = this.now();
    const ch = (this.opts.rng ?? randomKana)();
    const cur = this.matcher.step(prev.cur, ch);
    const next: State = {
      ...prev,
      total: prev.total + 1,
      cur,
      best: Math.max(prev.best, cur),
      bestAt: cur > prev.best ? ts : prev.bestAt,
      completedAt: cur === this.opts.target.length ? ts : null,
    };
    const row: CharRow = { id: next.total, ch, ts };
    try {
      await this.opts.store.commitTick(row, next);
    } catch (e) {
      this.opts.onError?.(e);
      return;
    }
    this.state = next;
    this.recent.push(row);
    if (this.recent.length > RECENT_IN_MEMORY) this.recent.shift();
    for (const fn of this.listeners) fn({ row, state: next });
  }
}

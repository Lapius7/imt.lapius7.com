export interface State {
  total: number;
  cur: number;
  best: number;
  bestAt: number | null;
  startedAt: number;
  completedAt: number | null;
}
export interface CharRow {
  id: number;
  ch: string;
  ts: number;
}
export interface Snapshot {
  state: State;
  targetLength: number;
  tickMs: number;
  retain: number;
  now: number;
  recent: CharRow[];
}
export type Connection = "connecting" | "open" | "retrying";

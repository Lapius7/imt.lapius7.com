import { useCallback, useEffect, useRef, useState } from "react";
import type { CharRow, Connection, Snapshot, State } from "@/types";

const MAX_ROWS = 20000;

function merge(prev: CharRow[], incoming: CharRow[]): CharRow[] {
  if (incoming.length === 0) return prev;
  const map = new Map<number, CharRow>();
  for (const r of prev) map.set(r.id, r);
  for (const r of incoming) map.set(r.id, r);
  const all = [...map.values()].sort((a, b) => a.id - b.id);
  return all.length > MAX_ROWS ? all.slice(all.length - MAX_ROWS) : all;
}

/** SSE でサーバーの状態を受け取る。切れたら自動で再接続し、接続のたびに最新の snapshot で補う。 */
export function useMonkey() {
  const [state, setState] = useState<State | null>(null);
  const [meta, setMeta] = useState<{ targetLength: number; tickMs: number; retain: number } | null>(null);
  const [rows, setRows] = useState<CharRow[]>([]);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [clockOffset, setClockOffset] = useState(0); // サーバー時刻 - 手元の時刻
  const [exhausted, setExhausted] = useState(false);
  const rowsRef = useRef<CharRow[]>([]);
  rowsRef.current = rows;

  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const open = () => {
      es = new EventSource("/api/stream");
      es.onopen = () => setConnection("open");
      es.onerror = () => {
        setConnection("retrying");
        // ブラウザが自動再接続を諦めた(CLOSED)ときは、こちらで張り直す
        if (es?.readyState === EventSource.CLOSED && !closed) {
          es.close();
          retry = setTimeout(open, 3000);
        }
      };
      es.addEventListener("snapshot", (e) => {
        const snap = JSON.parse((e as MessageEvent).data) as Snapshot;
        setState(snap.state);
        setMeta({ targetLength: snap.targetLength, tickMs: snap.tickMs, retain: snap.retain });
        setClockOffset(snap.now - Date.now());
        setRows((r) => merge(r, snap.recent));
      });
      es.addEventListener("char", (e) => {
        const { row, state } = JSON.parse((e as MessageEvent).data) as { row: CharRow; state: State };
        setState(state);
        setRows((r) => merge(r, [row]));
      });
    };
    open();
    return () => {
      closed = true;
      clearTimeout(retry);
      es?.close();
    };
  }, []);

  /** ログの古い側を 600 文字ずつ読み足す。 */
  const loadOlder = useCallback(async () => {
    const oldest = rowsRef.current[0]?.id;
    if (oldest === undefined) return;
    const res = await fetch(`/api/recent?limit=600&before=${oldest}`);
    const { rows: older } = (await res.json()) as { rows: CharRow[] };
    if (older.length < 600) setExhausted(true);
    setRows((r) => merge(r, older));
  }, []);

  return { state, meta, rows, connection, clockOffset, loadOlder, exhausted };
}

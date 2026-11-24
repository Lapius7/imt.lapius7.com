import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clock, num } from "@/lib/format";
import type { CharRow } from "@/types";

const PER_LINE = 30;

/** 最近の生成文字のログ。30 文字ごとに 1 行、新しい行が上。 */
export function LogView({ rows, retain, loadOlder, exhausted }: { rows: CharRow[]; retain: number; loadOlder: () => Promise<void>; exhausted: boolean }) {
  const [loading, setLoading] = useState(false);
  const lines = useMemo(() => {
    const map = new Map<number, CharRow[]>();
    for (const r of rows) {
      const k = Math.floor((r.id - 1) / PER_LINE);
      const l = map.get(k);
      if (l) l.push(r);
      else map.set(k, [r]);
    }
    return [...map.entries()].sort((x, y) => y[0] - x[0]);
  }, [rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base leading-6">最近の生成文字</CardTitle>
        <CardDescription className="leading-5">直近 {num(retain)} 文字(1 日分)を保存しています。行頭は、その行の最初の文字の時刻です。</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-80 overflow-y-auto overscroll-contain rounded-lg bg-muted/40 p-3" tabIndex={0} aria-label="最近の生成文字のログ">
          <ol className="flex flex-col gap-0.5 text-sm leading-6">
            {lines.map(([k, l]) => (
              <li key={k} className="flex gap-3">
                <time className="tnum shrink-0 text-muted-foreground" dateTime={new Date(l[0]!.ts).toISOString()}>
                  {clock(l[0]!.ts)}
                </time>
                <span className="tracking-widest break-all">{l.map((r) => r.ch).join("")}</span>
              </li>
            ))}
          </ol>
          {!exhausted && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 h-8 leading-5"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                try {
                  await loadOlder();
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "読み込み中" : "古い文字を読み込む"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

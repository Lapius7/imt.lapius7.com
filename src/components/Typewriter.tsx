import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CharRow, Connection } from "@/types";

const SHOWN = 40;

const connLabel: Record<Connection, string> = { connecting: "接続中", open: "リアルタイム受信中", retrying: "再接続中" };

/** いま生成されている文字の流れ。新しい 1 文字が打ち込まれ、次の 1 文字までの進みが下の線で見える。 */
export function Typewriter({
  rows,
  cur,
  tickMs,
  connection,
  completed,
}: {
  rows: CharRow[];
  cur: number;
  tickMs: number;
  connection: Connection;
  completed: boolean;
}) {
  const shown = rows.slice(-SHOWN);
  const last = shown.at(-1);
  // 直近 cur 文字が、目標文の先頭と一致している部分
  const firstMatched = shown.length - Math.min(cur, shown.length);

  // 画面が裏にあった間の遅れで線がずれないよう、最後の文字の時刻から経過を求める
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!last) return;
    setElapsed(Math.min(Math.max(Date.now() - last.ts, 0), tickMs));
  }, [last?.id, tickMs]);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle className="text-base leading-6">いま生成されている文字</CardTitle>
        <Badge variant="outline" className="leading-4" aria-live="polite">
          <svg
            aria-hidden
            data-icon="inline-start"
            viewBox="0 0 6 6"
            className={`${connection === "open" ? "text-match" : "text-muted-foreground"}`}
          >
            <circle cx="3" cy="3" r="3" fill="currentColor" />
          </svg>
          <span className="translate-y-[0.5px]">{completed ? "完了" : connLabel[connection]}</span>
        </Badge>
      </CardHeader>
      <CardContent>
        <div
          className="relative flex h-20 items-center justify-end overflow-hidden rounded-lg bg-muted/50 px-4 text-5xl leading-none font-medium sm:text-6xl"
          style={{ maskImage: "linear-gradient(to right, transparent, #000 18%)" }}
          aria-label={shown.map((r) => r.ch).join("")}
          role="img"
        >
          {shown.map((r, i) => (
            <span
              key={r.id}
              className={`inline-flex h-[1.4em] w-[1.15em] shrink-0 items-center justify-center ${
                i >= firstMatched ? "text-match" : "text-foreground/85"
              } ${r === last ? "type-in" : ""}`}
            >
              {r.ch}
            </span>
          ))}
          {!completed && <span aria-hidden className="caret ml-1 h-[1em] w-0.5 shrink-0 rounded-full bg-foreground" />}
        </div>
        <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          {!completed && last && (
            <div
              key={last.id}
              className="tick-bar h-full w-full bg-foreground/40"
              style={{ ["--tick-ms" as string]: `${tickMs - elapsed}ms`, transform: `scaleX(${elapsed / tickMs})` }}
            />
          )}
        </div>
        <p className="mt-3 text-sm leading-5 text-muted-foreground">
          緑の文字は、目標文の先頭から連続して一致している部分です。{tickMs / 1000} 秒に 1 文字ずつ、サーバーが1か所で生成しています。
        </p>
      </CardContent>
    </Card>
  );
}

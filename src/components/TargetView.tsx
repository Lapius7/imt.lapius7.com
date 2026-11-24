import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { num } from "@/lib/format";

/** 目標文を並べ、一致できた部分を強調する。 */
export const TargetView = memo(function TargetView({ target, cur, best }: { target: string; cur: number; best: number }) {
  const a = target.slice(0, cur);
  const b = target.slice(cur, Math.max(best, cur));
  const c = target.slice(Math.max(best, cur));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base leading-6">目標文</CardTitle>
        <CardDescription className="leading-5">
          太宰治『走れメロス』を清音ひらがなに直した {num(target.length)} 文字。濃い緑が現在の一致、薄い緑がこれまでの最長一致です。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          tabIndex={0}
          aria-label="目標文"
          className="max-h-64 overflow-y-auto overscroll-contain rounded-lg bg-muted/40 p-4 text-base leading-8 tracking-wider break-all outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {a && <span className="rounded-sm bg-match px-0.5 font-medium text-background">{a}</span>}
          {b && <span className="rounded-sm bg-match-soft px-0.5 text-match">{b}</span>}
          <span className="text-muted-foreground">{c}</span>
        </div>
      </CardContent>
    </Card>
  );
});

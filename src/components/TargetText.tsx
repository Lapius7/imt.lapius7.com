import { Crosshair } from "lucide-react";
import { memo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 目標文を並べ、一致できた部分を色付けする。
 * 色は背景だけで付け、padding・字間・太さは変えない(変えると一致した文字だけ右にずれ、
 * 枠が隣の文字に重なる。折り返しで枠が切れないよう box-decoration-break も指定する)。
 */
const hl = "rounded-[3px] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]";

export const TargetText = memo(function TargetText({
  target,
  cur,
  best,
  jump = false,
  className,
}: {
  target: string;
  cur: number;
  best: number;
  jump?: boolean;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const hi = Math.max(best, cur);
  const a = target.slice(0, cur);
  const b = target.slice(cur, hi);
  const c = target.slice(hi);

  const goCurrent = useCallback(() => {
    const el = box.current;
    const at = anchor.current;
    if (!el || !at) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top = at.offsetTop - el.clientHeight / 2 + at.offsetHeight / 2;
    el.scrollTo({ top: Math.max(top, 0), behavior: reduce ? "auto" : "smooth" });
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {jump && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm leading-6 text-muted-foreground">
            <span className="mr-3 inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 shrink-0 rounded-[3px] bg-match" />
              現在の一致
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 shrink-0 rounded-[3px] bg-match-soft" />
              これまでの最長
            </span>
          </p>
          <Button variant="outline" size="sm" onClick={goCurrent} className="shrink-0 gap-1.5">
            <Crosshair className="size-4 shrink-0" aria-hidden />
            現在位置へ
          </Button>
        </div>
      )}
      <div
        ref={box}
        tabIndex={0}
        aria-label="目標文"
        className={cn(
          "relative overflow-y-auto overscroll-contain rounded-lg bg-muted/40 p-4 text-base leading-8 break-all outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        {a && <span className={cn(hl, "bg-match text-background")}>{a}</span>}
        <span ref={anchor} aria-hidden />
        {b && <span className={cn(hl, "bg-match-soft text-match")}>{b}</span>}
        <span className="text-muted-foreground">{c}</span>
      </div>
    </div>
  );
});

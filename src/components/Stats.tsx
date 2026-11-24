import { estimate } from "@shared/estimate";
import { Card, CardContent } from "@/components/ui/card";
import { exp, num } from "@/lib/format";
import type { State } from "@/types";

const AGE_OF_UNIVERSE_LOG10 = Math.log10(1.38e10);

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardContent className="flex min-w-0 flex-col gap-1">
        <div className="text-sm leading-5 text-muted-foreground">{label}</div>
        <div className="tnum text-2xl leading-8 font-semibold break-words">{value}</div>
        {sub && <div className="text-xs leading-4 break-words text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function uptime(ms: number): string {
  const m = Math.floor(ms / 60000);
  return `${Math.floor(m / 1440)} 日 ${Math.floor((m % 1440) / 60)} 時間 ${m % 60} 分`;
}

export function Stats({ state, target, targetLength, tickMs, now }: { state: State; target: string; targetLength: number; tickMs: number; now: number }) {
  const end = state.completedAt ?? now;
  const est = estimate(targetLength, state.total, tickMs);
  const bestText = target.slice(0, state.best);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile label="累計生成文字数" value={`${num(state.total)} 文字`} sub={`${tickMs / 1000} 秒に 1 文字。実際に生成した分だけを数えます`} />
      <Tile
        label="稼働日数"
        value={uptime(Math.max(end - state.startedAt, 0))}
        sub={`${new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(state.startedAt))} から`}
      />
      <Tile label="現在の一致の長さ" value={`${num(state.cur)} 文字`} sub="目標文の先頭から連続して一致" />
      <Tile
        label="これまでの最長一致"
        value={`${num(state.best)} 文字`}
        sub={bestText ? <span className="text-foreground/80">「{bestText.length > 40 ? `${bestText.slice(0, 40)}…` : bestText}」</span> : "まだありません"}
      />
      <Tile label="目標文の長さ" value={`${num(targetLength)} 文字`} sub="清音ひらがなに直した『走れメロス』の全文" />
      <Tile
        label="全文一致の確率の見積もり"
        value={
          <>
            10<sup className="text-base">-{exp(est.log10PerWindow)}</sup>
          </>
        }
        sub="連続 N 文字を 1 回引いて、全文と一致する確率(1/46 の N 乗)"
      />
      <Tile
        label="ここまでに全文一致している確率"
        value={
          est.log10SoFar === null ? (
            "0"
          ) : (
            <>
              約 10<sup className="text-base">-{exp(est.log10SoFar)}</sup>
            </>
          )
        }
        sub={est.log10SoFar === null ? "まだ目標文の長さに届いていません" : "試行回数 × 1 回の確率"}
      />
      <Tile
        label="全文一致までの期待時間"
        value={
          <>
            約 10<sup className="text-base">{exp(est.log10YearsExpected)}</sup> 年
          </>
        }
        sub={`宇宙の年齢(約 138 億年)の約 10 の ${exp(est.log10YearsExpected - AGE_OF_UNIVERSE_LOG10)} 乗倍。一様乱数・1 文字 1/46 として計算した値です`}
      />
    </div>
  );
}

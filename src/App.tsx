import { useEffect, useState } from "react";
import { LogView } from "@/components/LogView";
import { Stats } from "@/components/Stats";
import { TargetView } from "@/components/TargetView";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Typewriter } from "@/components/Typewriter";
import { Card, CardContent } from "@/components/ui/card";
import { dateTime } from "@/lib/format";
import { useMonkey } from "@/hooks/useMonkey";

export default function App() {
  const { state, meta, rows, connection, clockOffset, loadOlder, exhausted } = useMonkey();
  const [target, setTarget] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    fetch("/api/target").then((r) => r.text()).then(setTarget).catch(() => {});
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ready = state && meta;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl leading-9 font-semibold sm:text-3xl sm:leading-10">無限の猿定理シミュレータ</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            1 秒に 1 文字、ランダムなひらがなを生成し続けて、太宰治『走れメロス』の全文と一致する日を待ちます。サーバーが 1 か所で動かしているので、誰が見ても同じ状態です。
            <a href="/text" className="ml-1 underline underline-offset-4 hover:text-foreground">
              走れメロスの全文を読む
            </a>
          </p>
        </div>
        <ThemeToggle />
      </header>

      {state?.completedAt && (
        <Card className="ring-2 ring-match">
          <CardContent className="text-base leading-7 font-medium">
            全文一致しました。完了日時: {dateTime(state.completedAt)}(累計 {state.total.toLocaleString("ja-JP")} 文字)
          </CardContent>
        </Card>
      )}

      {ready ? (
        <>
          <Typewriter rows={rows} cur={state.cur} tickMs={meta.tickMs} connection={connection} completed={!!state.completedAt} />
          <Stats state={state} target={target} targetLength={meta.targetLength} tickMs={meta.tickMs} now={now + clockOffset} />
          <TargetView target={target} cur={state.cur} best={state.best} />
          <LogView rows={rows} retain={meta.retain} loadOlder={loadOlder} exhausted={exhausted} />
        </>
      ) : (
        <p className="py-16 text-center text-sm leading-6 text-muted-foreground" role="status">
          {connection === "retrying" ? "サーバーに接続できません。再接続しています" : "読み込み中"}
        </p>
      )}

      <footer className="mt-4 text-xs leading-5 text-muted-foreground">
        判定は、濁点・半濁点・小書き文字を清音に直したうえで行います(が→か、ぱ→は、っ→つ)。生成列が目標文の先頭から連続して一致している長さを追い、不一致のときは KMP の失敗関数に従って戻します。本文は青空文庫の『走れメロス』です。
      </footer>
    </div>
  );
}

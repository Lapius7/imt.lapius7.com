import { ArrowLeft } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { TargetText } from "@/components/TargetText";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMonkey } from "@/hooks/useMonkey";
import { num } from "@/lib/format";

type Seg = string | [string, string];
interface Para {
  s: Seg[];
  right?: true;
}

const TABS = ["original", "target"] as const;
type Tab = (typeof TABS)[number];
const fromHash = (): Tab => (location.hash === "#target" ? "target" : "original");

/** 原文。親文字とルビは <ruby> で出す。字下げ(行頭の全角空白)は本文のまま残す。 */
function Original({ paragraphs }: { paragraphs: Para[] }) {
  return (
    <article lang="ja" className="flex flex-col gap-3 text-[17px] leading-[2.1] sm:text-lg sm:leading-[2.15]">
      {paragraphs.map((p, i) => (
        <p key={i} className={`whitespace-pre-wrap break-words ${p.right ? "text-right" : ""}`}>
          {p.s.map((seg, j) =>
            typeof seg === "string" ? (
              <Fragment key={j}>{seg}</Fragment>
            ) : (
              <ruby key={j}>
                {seg[0]}
                <rp>(</rp>
                <rt>{seg[1]}</rt>
                <rp>)</rp>
              </ruby>
            ),
          )}
        </p>
      ))}
    </article>
  );
}

export default function TextPage() {
  const { state } = useMonkey();
  const [target, setTarget] = useState("");
  const [paragraphs, setParagraphs] = useState<Para[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>(fromHash);

  useEffect(() => {
    fetch("/api/target").then((r) => r.text()).then(setTarget).catch(() => setFailed(true));
    fetch("/api/text").then((r) => r.json()).then((j: { paragraphs: Para[] }) => setParagraphs(j.paragraphs)).catch(() => setFailed(true));
  }, []);
  useEffect(() => {
    const on = () => setTab(fromHash());
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);

  const change = (v: string) => {
    setTab(v as Tab);
    history.replaceState(null, "", v === "target" ? "#target" : location.pathname);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <a href="/" className="inline-flex items-center gap-1.5 text-sm leading-6 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            無限の猿定理シミュレータ
          </a>
          <h1 className="mt-3 text-2xl leading-9 font-semibold sm:text-3xl sm:leading-10">走れメロス 全文</h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">太宰治</p>
        </div>
        <ThemeToggle />
      </header>

      <Tabs value={tab} onValueChange={change} className="gap-4">
        <TabsList>
          <TabsTrigger value="original">原文</TabsTrigger>
          <TabsTrigger value="target">目標文(ひらがな)</TabsTrigger>
        </TabsList>

        <TabsContent value="original">
          {paragraphs ? (
            <Original paragraphs={paragraphs} />
          ) : (
            <p className="py-16 text-center text-sm leading-6 text-muted-foreground" role="status">
              {failed ? "読み込めませんでした" : "読み込み中"}
            </p>
          )}
        </TabsContent>

        <TabsContent value="target" className="flex flex-col gap-3">
          <p className="text-sm leading-6 text-muted-foreground">
            シミュレータが一致を調べている文です。『走れメロス』を清音ひらがなに直した {target ? num(target.length) : ""} 文字で、濁点・半濁点・小書き文字は清音にしています。色付けは生成の進みにあわせて更新されます。
          </p>
          {target && state ? (
            <TargetText target={target} cur={state.cur} best={state.best} jump className="h-[65dvh] min-h-72" />
          ) : (
            <p className="py-16 text-center text-sm leading-6 text-muted-foreground" role="status">
              {failed ? "読み込めませんでした" : "読み込み中"}
            </p>
          )}
        </TabsContent>
      </Tabs>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-base leading-6">出典</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-7 text-muted-foreground">
          <p>
            青空文庫『走れメロス』(太宰治)。
            <a
              href="https://www.aozora.gr.jp/cards/000035/files/1567_14913.html"
              className="underline underline-offset-4 hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              元のファイル
            </a>
            から本文とルビを取り、行ごとに段落に整えて表示しています。本文の文字は変えていません。
          </p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt>底本</dt>
            <dd>『太宰治全集3』ちくま文庫、筑摩書房、1988(昭和63)年10月25日初版発行、1998(平成10)年6月15日第2刷</dd>
            <dt>底本の親本</dt>
            <dd>『筑摩全集類聚版太宰治全集』筑摩書房、1975(昭和50)年6月〜1976(昭和51)年6月</dd>
            <dt>入力</dt>
            <dd>金川一之</dd>
            <dt>校正</dt>
            <dd>高橋美奈子</dd>
            <dt>公開</dt>
            <dd>2000年12月4日(2011年1月17日修正)</dd>
          </dl>
          <p className="mt-3">
            このファイルは、インターネットの図書館
            <a href="https://www.aozora.gr.jp/" className="mx-1 underline underline-offset-4 hover:text-foreground" target="_blank" rel="noreferrer">
              青空文庫
            </a>
            で作られました。入力、校正、制作にあたったのは、ボランティアの皆さんです。ひらがなの目標文は、この本文から本サイトが作った二次的なデータで、青空文庫の本文そのものではありません。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

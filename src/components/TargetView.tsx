import { memo } from "react";
import { TargetText } from "@/components/TargetText";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { num } from "@/lib/format";

/** 目標文のカード。一致済みの部分は TargetText が色付けする。 */
export const TargetView = memo(function TargetView({ target, cur, best }: { target: string; cur: number; best: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base leading-6">目標文</CardTitle>
        <CardDescription className="leading-5">
          太宰治『走れメロス』を清音ひらがなに直した {num(target.length)} 文字。濃い緑が現在の一致、薄い緑がこれまでの最長一致です。
          <a href="/text" className="ml-1 underline underline-offset-4 hover:text-foreground">
            全文を読む
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TargetText target={target} cur={cur} best={best} className="max-h-64" />
      </CardContent>
    </Card>
  );
});

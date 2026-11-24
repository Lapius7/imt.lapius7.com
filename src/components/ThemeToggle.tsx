import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return (
    <Button
      variant="outline"
      size="icon"
      className="size-9 shrink-0"
      aria-label={dark ? "ライトテーマにする" : "ダークテーマにする"}
      onClick={() => {
        localStorage.setItem("theme", dark ? "light" : "dark");
        setDark(!dark);
      }}
    >
      {dark ? <Sun className="size-4 shrink-0" /> : <Moon className="size-4 shrink-0" />}
    </Button>
  );
}

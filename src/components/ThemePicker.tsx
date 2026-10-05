"use client";

import { useEffect, useState } from "react";
import { THEME_KEY } from "@/lib/theme";

export type Theme = "light" | "dark" | "green";

const THEMES: { id: Theme; icon: string; label: string }[] = [
  { id: "light", icon: "☀️", label: "라이트" },
  { id: "dark", icon: "🌙", label: "다크" },
  { id: "green", icon: "🌿", label: "그린" },
];

function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark" || set === "green") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** 라이트 · 다크 · 그린 중 고르는 작은 버튼 묶음. 고른 값은 이 브라우저에 기억한다 */
export default function ThemePicker({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 지금 적용된 테마는 브라우저에서만 알 수 있다
    setTheme(currentTheme());
  }, []);

  const choose = (t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {}
    setTheme(t);
  };

  return (
    <div role="radiogroup" aria-label="화면 테마" className="flex shrink-0 items-center gap-0.5 rounded-full bg-surface-2 p-0.5">
      {THEMES.map((t) => {
        const on = theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            title={`${t.label} 화면`}
            onClick={() => choose(t.id)}
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold transition ${
              on ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <span aria-hidden>{t.icon}</span>
            <span className={compact ? "hidden md:inline" : ""}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

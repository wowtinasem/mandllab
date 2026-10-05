"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 가로로 나뉜 두 영역 중 왼쪽 너비(px)를 마우스·키보드로 조절한다.
 * - 경계선을 끌거나, 포커스 후 ←/→ 로 조절, 더블클릭하면 기본값으로
 * - 정한 너비는 이 브라우저에 기억한다
 * 끄는 동안에는 화면 전체를 덮는 투명 막을 깔아, 미리보기 iframe 이 마우스를 가로채지 않게 한다.
 */
export function useResizable({
  storageKey,
  defaultWidth,
  min,
  maxRatio = 0.75,
  minRight = 320,
}: {
  storageKey: string;
  defaultWidth: number;
  min: number;
  maxRatio?: number;
  minRight?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(defaultWidth);
  const [dragging, setDragging] = useState(false);
  // 사용자가 직접 바꿨을 때만 저장한다. 처음 화면이 뜰 때 기본값으로 저장된 값을 덮어쓰지 않도록
  const userChanged = useRef(false);

  const clamp = useCallback(
    (w: number) => {
      const total = containerRef.current?.clientWidth ?? window.innerWidth;
      const max = Math.max(min, Math.min(total * maxRatio, total - minRight));
      return Math.round(Math.min(max, Math.max(min, w)));
    },
    [min, maxRatio, minRight],
  );

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저에 저장된 너비는 마운트 뒤에만 읽을 수 있다
      if (saved > 0) setWidth(clamp(saved));
    } catch {}
  }, [storageKey, clamp]);

  const save = useCallback(
    (w: number) => {
      try {
        localStorage.setItem(storageKey, String(w));
      } catch {}
    },
    [storageKey],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const left = containerRef.current?.getBoundingClientRect().left ?? 0;
      setWidth(clamp(e.clientX - left));
    };
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, clamp]);

  useEffect(() => {
    if (!dragging && userChanged.current) save(width);
  }, [dragging, width, save]);

  const handleProps = {
    role: "separator" as const,
    "aria-orientation": "vertical" as const,
    "aria-label": "창 크기 조절 (화살표 키로 조절, 더블클릭하면 원래대로)",
    "aria-valuenow": width,
    tabIndex: 0,
    title: "끌어서 크기 조절 · 더블클릭하면 원래대로",
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      userChanged.current = true;
      setDragging(true);
    },
    onDoubleClick: () => {
      userChanged.current = true;
      setWidth(clamp(defaultWidth));
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        userChanged.current = true;
        setWidth((w) => clamp(w + (e.key === "ArrowLeft" ? -40 : 40)));
      }
    },
  };

  const overlay = dragging ? <div className="fixed inset-0 z-[60] cursor-col-resize" aria-hidden /> : null;

  return { containerRef, width, dragging, handleProps, overlay };
}

/** 두 영역 사이의 경계선 */
export function SplitHandle({ props, dragging }: { props: ReturnType<typeof useResizable>["handleProps"]; dragging: boolean }) {
  return (
    <div
      {...props}
      className={`group relative z-10 -mx-1 hidden w-2 shrink-0 cursor-col-resize touch-none lg:block`}
    >
      <div
        className={`mx-auto h-full w-px transition-colors ${dragging ? "w-0.5 bg-accent" : "bg-line group-hover:w-0.5 group-hover:bg-accent group-focus-visible:bg-accent"}`}
      />
      <div className="absolute top-1/2 left-1/2 flex h-10 w-3 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-full border border-line bg-surface opacity-70 shadow-sm group-hover:opacity-100">
        <span className="h-0.5 w-0.5 rounded-full bg-muted" />
        <span className="h-0.5 w-0.5 rounded-full bg-muted" />
        <span className="h-0.5 w-0.5 rounded-full bg-muted" />
      </div>
    </div>
  );
}

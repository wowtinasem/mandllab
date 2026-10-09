"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";

type Msg = { id: string; text: string; created_at: number; from_name: string | null };

const POLL_MS = 15_000;

/**
 * 강사 화면에 붙이는 메모 팝업.
 * 15초마다(그리고 창으로 돌아올 때) 메인 관리자 메모를 확인하고, 있으면 가운데에 작은 팝업을 띄운다.
 * 이 확인이 곧 "접속 중" 표시가 된다.
 */
export default function MessagePopup() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    try {
      const r = await api<{ messages: Msg[] }>("/api/instructor/messages");
      setMsgs(r.messages);
    } catch {}
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 바로 한 번 확인한다
    check();
    const t = setInterval(check, POLL_MS);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  if (!msgs.length) return null;
  const m = msgs[0];

  const confirm = async () => {
    setBusy(true);
    try {
      await api("/api/instructor/messages", { method: "PATCH", body: { ids: [m.id] } });
      setMsgs((cur) => cur.slice(1));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="msg-title">
      <div className="card w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 bg-accent px-5 py-3 text-accent-fg">
          <span className="text-xl">📨</span>
          <b id="msg-title" className="flex-1">
            메인 관리자 메모
          </b>
          {msgs.length > 1 && <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">{msgs.length}개</span>}
        </div>
        <div className="p-5">
          <p className="whitespace-pre-wrap text-[17px] leading-relaxed">{m.text}</p>
          <p className="mt-3 text-xs text-muted">
            {m.from_name ?? "메인 관리자"} ·{" "}
            {new Date(m.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
          <button className="btn-primary mt-5 w-full py-3" onClick={confirm} disabled={busy} autoFocus>
            {msgs.length > 1 ? "확인했습니다 (다음 메모 보기)" : "확인했습니다"}
          </button>
        </div>
      </div>
    </div>
  );
}

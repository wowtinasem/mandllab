"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";

type Msg = {
  id: string;
  text: string;
  created_at: number;
  from_name: string | null;
  from_role: "admin" | "instructor" | null;
  reply_to_text: string | null;
};

const POLL_MS = 15_000;

const timeText = (t: number) => new Date(t).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * 강사·메인 관리자 화면에 붙이는 메시지 팝업.
 * 15초마다(그리고 창으로 돌아올 때) 새 메시지를 확인하고, 있으면 가운데에 작은 팝업을 띄운다.
 * 팝업에서 바로 답장할 수 있다. 이 확인이 곧 "접속 중" 표시가 된다.
 */
export default function MessagePopup() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

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
  const fromAdmin = m.from_role === "admin";

  const done = async (replyText?: string) => {
    setBusy(true);
    setError("");
    try {
      if (replyText) await api("/api/instructor/messages", { body: { text: replyText, replyTo: m.id } });
      await api("/api/instructor/messages", { method: "PATCH", body: { ids: [m.id] } });
      setMsgs((cur) => cur.slice(1));
      setReplying(false);
      setReply("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="msg-title">
      <div className="card w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 bg-accent px-5 py-3 text-accent-fg">
          <span className="text-xl">{fromAdmin ? "📨" : "💬"}</span>
          <b id="msg-title" className="flex-1">
            {fromAdmin ? "메인 관리자 메모" : `${m.from_name ?? "강사"} 강사의 메시지`}
          </b>
          {msgs.length > 1 && <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">{msgs.length}개</span>}
        </div>
        <div className="p-5">
          {m.reply_to_text && (
            <p className="mb-3 line-clamp-2 border-l-4 border-line pl-3 text-sm text-muted">↪ 내가 보낸 메시지: {m.reply_to_text}</p>
          )}
          <p className="whitespace-pre-wrap text-[17px] leading-relaxed">{m.text}</p>
          <p className="mt-3 text-xs text-muted">
            {m.from_name ?? "메인 관리자"} · {timeText(m.created_at)}
          </p>

          {replying && (
            <div className="mt-4">
              <label htmlFor="reply-text" className="label">
                답장
              </label>
              <textarea
                id="reply-text"
                className="input min-h-20"
                maxLength={500}
                autoFocus
                placeholder={fromAdmin ? "예: 네, 확인했습니다. 10분 뒤 쉬겠습니다." : "답장을 적어 주세요"}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
            </div>
          )}
          {error && <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

          <div className="mt-5 flex gap-2">
            {replying ? (
              <>
                <button className="btn-ghost" onClick={() => setReplying(false)} disabled={busy}>
                  취소
                </button>
                <button className="btn-primary flex-1 py-3" onClick={() => done(reply.trim())} disabled={busy || !reply.trim()}>
                  {busy ? "보내는 중…" : "답장 보내기"}
                </button>
              </>
            ) : (
              <>
                <button className="btn-ghost py-3" onClick={() => setReplying(true)} disabled={busy}>
                  ↩ 답장하기
                </button>
                <button className="btn-primary flex-1 py-3" onClick={() => done()} disabled={busy} autoFocus>
                  {msgs.length > 1 ? "확인 (다음 메시지)" : "확인했습니다"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

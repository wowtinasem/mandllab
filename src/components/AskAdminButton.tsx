"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

const QUICK = [
  "학생 요청 한도를 늘려 주세요.",
  "AI 응답이 느립니다. 확인 부탁드립니다.",
  "수업 중 도움이 필요합니다. 연락 부탁드립니다.",
];

/**
 * 강사가 메인 관리자에게 메시지를 보내는 버튼과 작은 창.
 * 메인 관리자 본인에게는 보이지 않는다.
 */
export default function AskAdminButton({ className = "btn-ghost" }: { className?: string }) {
  const [role, setRole] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api<{ instructor: { role: string } | null }>("/api/instructor/me")
      .then((r) => setRole(r.instructor?.role ?? null))
      .catch(() => {});
  }, []);

  if (role !== "instructor") return null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await api("/api/instructor/messages", { body: { text } });
      setText("");
      setNotice({ ok: true, text: "✓ 메인 관리자에게 보냈어요. 답장이 오면 화면에 팝업으로 떠요." });
    } catch (err) {
      setNotice({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setOpen(true);
          setNotice(null);
        }}
      >
        💬 <span className="hidden sm:inline">관리자에게 </span>메시지
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4 text-left text-base print:hidden" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <form onSubmit={send} className="card w-full max-w-md space-y-3 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">💬 메인 관리자에게 메시지</h2>
              <button type="button" className="rounded-lg px-2 py-1 text-muted hover:bg-surface-2" onClick={() => setOpen(false)} aria-label="닫기">
                ✕
              </button>
            </div>
            <textarea
              className="input min-h-28"
              maxLength={500}
              autoFocus
              placeholder="예: 학생 요청 한도를 늘려 주세요."
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="메시지"
            />
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button type="button" key={q} className="chip" onClick={() => setText(q)}>
                  {q}
                </button>
              ))}
            </div>
            {notice && <p className={`rounded-lg px-3 py-2 text-sm ${notice.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>{notice.text}</p>}
            <button className="btn-primary w-full py-3" disabled={busy || !text.trim()}>
              {busy ? "보내는 중…" : "보내기"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

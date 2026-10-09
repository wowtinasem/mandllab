"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { api, formatDateTime } from "@/lib/client";

type Target = "online" | "teaching" | "all" | "one";
type Person = { instructorId: string; name: string; online: boolean; teaching: boolean };
type Sent = { id: string; text: string; created_at: number; to: { name: string; read: boolean }[] };
type Received = {
  id: string;
  text: string;
  created_at: number;
  read_at: number | null;
  from_name: string | null;
  reply_to_text: string | null;
  replied: number;
};

export type MessageComposerHandle = { pick: (instructorId: string) => void };

const QUICK = ["10분 뒤 쉬는 시간입니다.", "수업 종료 10분 전입니다. 학생들에게 다운로드를 안내해 주세요.", "AI 사용량이 많습니다. 한도 설정을 확인해 주세요."];

/** 메인 관리자: 강사에게 메모 보내기 (접속 중 / 수업 중 / 모든 강사 / 한 명) */
const MessageComposer = forwardRef<MessageComposerHandle, { people: Person[] }>(function MessageComposer({ people }, ref) {
  const [target, setTarget] = useState<Target>("online");
  const [one, setOne] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [sent, setSent] = useState<Sent[]>([]);
  const [received, setReceived] = useState<Received[]>([]);
  const [box, setBox] = useState<"received" | "sent">("received");
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const loadSent = useCallback(
    () =>
      api<{ sent: Sent[]; received: Received[] }>("/api/admin/messages").then((r) => {
        setSent(r.sent);
        setReceived(r.received);
      }),
    [],
  );

  const sendReply = async (m: Received) => {
    try {
      await api("/api/instructor/messages", { body: { text: replyText, replyTo: m.id } });
      // 답장하면 그 메시지는 확인한 것으로 본다
      if (!m.read_at) await api("/api/instructor/messages", { method: "PATCH", body: { ids: [m.id] } });
      setReplyId(null);
      setReplyText("");
      loadSent();
    } catch (err) {
      setNotice({ ok: false, text: (err as Error).message });
    }
  };
  const unread = received.filter((m) => !m.read_at).length;
  useEffect(() => {
    // 마운트 시와 15초마다 확인 현황을 새로 고친다
    loadSent().catch(() => {});
    const t = setInterval(() => loadSent().catch(() => {}), 15_000);
    return () => clearInterval(t);
  }, [loadSent]);

  useImperativeHandle(ref, () => ({
    pick: (id: string) => {
      setTarget("one");
      setOne(id);
      setNotice(null);
    },
  }));

  const online = people.filter((p) => p.online).length;
  const teaching = people.filter((p) => p.teaching).length;
  const options: [Target, string][] = [
    ["online", `🟢 지금 접속 중인 강사 (${online}명)`],
    ["teaching", `📚 수업 중인 강사 (${teaching}명)`],
    ["all", `👥 모든 강사 (${people.length}명)`],
    ["one", "👤 한 명 고르기"],
  ];

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const r = await api<{ sent: string[] }>("/api/admin/messages", { body: { target, instructorId: one, text } });
      setNotice({ ok: true, text: `✓ ${r.sent.length}명에게 보냈어요: ${r.sent.join(", ")}` });
      setText("");
      loadSent();
    } catch (err) {
      setNotice({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[360px_1fr]" id="message-composer">
      <form onSubmit={send} className="card h-fit space-y-3 p-5">
        <div>
          <h2 className="text-lg font-bold">✉ 강사에게 메모 보내기</h2>
          <p className="mt-1 text-xs text-muted">강사 화면에 15초 안에 팝업으로 떠요. 강사가 &ldquo;확인했습니다&rdquo;를 누르면 닫혀요.</p>
        </div>
        <fieldset className="space-y-1.5">
          <legend className="label">받는 사람</legend>
          {options.map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="radio" name="target" checked={target === k} onChange={() => setTarget(k)} />
              {label}
            </label>
          ))}
          {target === "one" && (
            <select className="input mt-1" value={one} onChange={(e) => setOne(e.target.value)} aria-label="받을 강사">
              <option value="">강사를 고르세요</option>
              {people.map((p) => (
                <option key={p.instructorId} value={p.instructorId}>
                  {p.name}
                  {p.online ? " · 접속 중" : ""}
                  {p.teaching ? " · 수업 중" : ""}
                </option>
              ))}
            </select>
          )}
        </fieldset>
        <div>
          <label htmlFor="msg-text" className="label">
            메모
          </label>
          <textarea
            id="msg-text"
            className="input min-h-24"
            maxLength={500}
            placeholder="예: 10분 뒤 쉬는 시간입니다."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button type="button" key={q} className="chip" onClick={() => setText(q)}>
                {q.length > 16 ? `${q.slice(0, 16)}…` : q}
              </button>
            ))}
          </div>
        </div>
        {notice && <p className={`rounded-lg px-3 py-2 text-sm ${notice.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>{notice.text}</p>}
        <button className="btn-primary w-full py-3" disabled={busy || !text.trim() || (target === "one" && !one)}>
          {busy ? "보내는 중…" : "메모 보내기"}
        </button>
      </form>

      <div>
        <div className="mb-3 flex gap-1 rounded-xl bg-surface-2 p-1 text-sm font-semibold sm:w-fit" role="tablist">
          <button
            role="tab"
            aria-selected={box === "received"}
            onClick={() => setBox("received")}
            className={`flex-1 rounded-lg px-4 py-1.5 sm:flex-none ${box === "received" ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
          >
            📥 받은 메시지
            {unread > 0 && <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.5 text-[11px] text-white">{unread}</span>}
          </button>
          <button
            role="tab"
            aria-selected={box === "sent"}
            onClick={() => setBox("sent")}
            className={`flex-1 rounded-lg px-4 py-1.5 sm:flex-none ${box === "sent" ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
          >
            📤 보낸 메모
          </button>
        </div>
        {box === "sent" ? (
          sent.length === 0 ? (
          <div className="card p-8 text-center text-muted">최근 2주 동안 보낸 메모가 없어요.</div>
        ) : (
          <ul className="space-y-2.5">
            {sent.map((m) => {
              const read = m.to.filter((t) => t.read).length;
              return (
                <li key={m.id} className="card p-4 text-sm">
                  <div className="flex items-start gap-3">
                    <p className="min-w-0 flex-1 whitespace-pre-wrap">{m.text}</p>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        read === m.to.length ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"
                      }`}
                    >
                      확인 {read}/{m.to.length}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-muted">
                    {formatDateTime(m.created_at)} ·{" "}
                    {m.to.map((t, i) => (
                      <span key={i} className={t.read ? "text-ok" : ""}>
                        {i > 0 && ", "}
                        {t.name}
                        {t.read ? " ✓" : ""}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )
        ) : received.length === 0 ? (
          <div className="card p-8 text-center text-muted">최근 2주 동안 강사에게 받은 메시지가 없어요.</div>
        ) : (
          <ul className="space-y-2.5">
            {received.map((m) => (
              <li key={m.id} className={`card p-4 text-sm ${m.read_at ? "" : "border-accent"}`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 text-xs font-bold text-accent">
                      💬 {m.from_name ?? "강사"}
                      {!m.read_at && <span className="ml-1.5 rounded bg-danger px-1.5 py-0.5 text-[10px] text-white">새 메시지</span>}
                    </div>
                    {m.reply_to_text && <p className="mb-1 line-clamp-1 border-l-4 border-line pl-2 text-xs text-muted">↪ 내 메모: {m.reply_to_text}</p>}
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  </div>
                  {m.replied > 0 ? (
                    <span className="shrink-0 rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-bold text-ok">답장함</span>
                  ) : (
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold text-accent hover:underline"
                      onClick={() => {
                        setReplyId(replyId === m.id ? null : m.id);
                        setReplyText("");
                      }}
                    >
                      ↩ 답장
                    </button>
                  )}
                </div>
                <div className="mt-2 text-xs text-muted">{formatDateTime(m.created_at)}</div>
                {replyId === m.id && (
                  <div className="mt-3 flex gap-2">
                    <input
                      className="input py-1.5 text-sm"
                      autoFocus
                      maxLength={500}
                      placeholder="답장을 적어 주세요"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing && replyText.trim()) {
                          e.preventDefault();
                          sendReply(m);
                        }
                      }}
                    />
                    <button type="button" className="btn-primary shrink-0 py-1.5" disabled={!replyText.trim()} onClick={() => sendReply(m)}>
                      보내기
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
});

export default MessageComposer;

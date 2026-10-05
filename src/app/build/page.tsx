"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Logo from "@/components/Logo";
import Preview from "@/components/Preview";
import { SplitHandle, useResizable } from "@/components/useResizable";
import { ApiError, api, formatDateTime, streamGenerate } from "@/lib/client";
import { HINTS, STARTERS } from "@/lib/starters";
import type { VersionMeta } from "@/lib/types";

type Me = {
  nickname: string;
  remaining: number;
  perLimit: number;
  headVersionId: string | null;
  versions: VersionMeta[];
  galleryVersionIds: string[];
  session: {
    title: string;
    code: string;
    status: "active" | "ended" | "expired";
    paused: boolean;
    mission: string;
    endsAt: number | null;
    expiresAt: number | null;
  };
  mockMode: boolean;
};

type Note = { at: number; tone: "info" | "warn" | "danger" | "answer"; text: string; question?: string };
type GalleryItem = { id: string; title: string; version_id: string; created_at: number; nickname: string; mine: number };
type Tab = "preview" | "code" | "gallery";

export default function Builder() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [htmlCache, setHtmlCache] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [streamText, setStreamText] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("preview");
  const [mobilePane, setMobilePane] = useState<"chat" | "app">("chat");
  const [showDownload, setShowDownload] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const {
    containerRef: chatSplitRef,
    width: chatWidth,
    dragging: chatDragging,
    handleProps: chatHandle,
    overlay: chatOverlay,
  } = useResizable({ storageKey: "ml:chatWidth", defaultWidth: 420, min: 300, maxRatio: 0.6 });
  const chatEnd = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const m = await api<Me>("/api/me");
      setMe(m);
      setSelectedId((cur) => cur ?? m.headVersionId);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.replace("/");
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 서버 상태를 불러오는 폴링
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  // 선택한 버전의 코드 불러오기
  useEffect(() => {
    if (!selectedId || htmlCache[selectedId]) return;
    api<{ html: string }>(`/api/versions/${selectedId}`)
      .then((v) => setHtmlCache((c) => ({ ...c, [selectedId]: v.html })))
      .catch(() => {});
  }, [selectedId, htmlCache]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [notes.length, me?.versions.length, busy]);

  const versions = useMemo(() => me?.versions ?? [], [me]);
  const selectedIndex = versions.findIndex((v) => v.id === selectedId);
  const selected = selectedIndex >= 0 ? versions[selectedIndex] : null;
  const html = selectedId ? htmlCache[selectedId] : undefined;
  const active = me?.session.status === "active";
  const canAsk = active && !me?.session.paused && !busy && (me?.remaining ?? 0) > 0;

  const addNote = (tone: Note["tone"], text: string, question?: string) =>
    setNotes((n) => [...n, { at: Date.now(), tone, text, question }]);

  const run = async (mode: "create" | "edit" | "fix" | "explain", text: string) => {
    if (!text.trim() || !canAsk) return;
    // 보낸 요청은 입력창에서 바로 지우고 대화 목록에 말풍선으로 보여준다
    if (mode === "create" || mode === "edit") setPrompt("");
    setPendingPrompt(mode === "fix" ? "앱 오류를 고쳐줘" : text);
    let failed = false;
    setBusy(true);
    setStatus("요청을 보내는 중…");
    setStreamText("");
    setPreviewError(null);
    if (mode !== "explain") setMobilePane("chat");
    try {
      await streamGenerate({ mode, prompt: text, baseVersionId: selectedId }, (ev) => {
        if (ev.t === "status") setStatus(ev.d);
        else if (ev.t === "delta") setStreamText((s) => (s + ev.d).slice(-4000));
        else if (ev.t === "warn") addNote("warn", ev.d);
        else if (ev.t === "refused") addNote("danger", `AI가 이 요청은 만들지 않았어요: ${ev.d}`);
        else if (ev.t === "error") {
          failed = true;
          addNote("danger", ev.d);
        }
        else if (ev.t === "done") {
          if (ev.answer) addNote("answer", ev.answer, text);
          if (ev.version) {
            const v = ev.version;
            setMe((m) => (m ? { ...m, versions: [...m.versions, v], headVersionId: v.id, remaining: ev.remaining } : m));
            setSelectedId(v.id);
            setTab("preview");
            setMobilePane("app");
          }
        }
      });
    } catch (e) {
      failed = true;
      addNote("danger", (e as Error).message);
    } finally {
      // 서버·네트워크 문제로 실패하면 다시 보낼 수 있게 요청 문장을 돌려놓는다
      if (failed && (mode === "create" || mode === "edit")) setPrompt((cur) => cur || text);
      setPendingPrompt(null);
      setBusy(false);
      setStatus("");
      setStreamText("");
      refresh();
    }
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    run(versions.length ? "edit" : "create", prompt);
  };

  const shareToGallery = async () => {
    if (!selectedId) return;
    try {
      await api("/api/gallery", { body: { versionId: selectedId } });
      addNote("info", `v${selected?.n} '${selected?.title}'을 갤러리에 올렸어요.`);
      refresh();
    } catch (e) {
      addNote("danger", (e as Error).message);
    }
  };

  const adoptVersion = (v: VersionMeta & { html?: string }) => {
    if (v.html) setHtmlCache((c) => ({ ...c, [v.id]: v.html! }));
    setMe((m) => (m ? { ...m, versions: [...m.versions, v], headVersionId: v.id } : m));
    setSelectedId(v.id);
    setTab("preview");
  };

  if (!me) {
    return <div className="grid min-h-screen place-items-center text-muted">불러오는 중…</div>;
  }

  return (
    <div className="flex h-dvh flex-col">
      {/* 상단 바 */}
      <header className="flex items-center gap-x-3 border-b border-line bg-surface px-4 py-2.5">
        <Logo href="/build" />
        <div className="min-w-0 flex-1 truncate text-sm">
          <span className="font-semibold">{me.session.title}</span>
          <span className="ml-2 text-muted">· {me.nickname}</span>
        </div>
        {me.mockMode && (
          <span className="hidden rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn sm:inline" title="GEMINI_API_KEY 가 설정되지 않았어요">
            데모 모드
          </span>
        )}
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            me.remaining <= 3 ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink"
          }`}
        >
          남은 요청 {me.remaining}/{me.perLimit}
        </span>
        <button
          className="text-xs text-muted hover:text-danger"
          onClick={async () => {
            if (!confirm("이 기기에서 나갈까요? 복귀 코드가 있으면 다시 들어올 수 있어요.")) return;
            await api("/api/leave", { body: {} });
            router.replace("/");
          }}
        >
          나가기
        </button>
      </header>

      {me.session.mission && active && (
        <div className="flex items-center gap-2 border-b border-line bg-accent-soft px-4 py-2 text-sm">
          <span className="font-bold text-accent">🎯 미션</span>
          <span>{me.session.mission}</span>
        </div>
      )}
      {!active && (
        <div className="border-b border-line bg-warn-soft px-4 py-2 text-sm text-warn">
          수업이 끝났어요. 결과물은 {me.session.expiresAt ? `${formatDateTime(me.session.expiresAt)}까지` : "당분간"} 내려받을 수 있어요.
        </div>
      )}

      {/* 모바일 전환 */}
      <div className="flex border-b border-line bg-surface lg:hidden">
        {(["chat", "app"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setMobilePane(p)}
            className={`flex-1 py-2.5 text-sm font-semibold ${mobilePane === p ? "border-b-2 border-accent text-accent" : "text-muted"}`}
          >
            {p === "chat" ? "대화" : "내 앱"}
          </button>
        ))}
      </div>

      <div ref={chatSplitRef} className="relative flex min-h-0 flex-1" style={{ "--chat-w": `${chatWidth}px` } as React.CSSProperties}>
        {/* 왼쪽: 대화 */}
        <section className={`${mobilePane === "chat" ? "flex" : "hidden"} w-full flex-col bg-bg lg:flex lg:w-[var(--chat-w)] lg:shrink-0`}>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {versions.length === 0 && !busy && (
              <div>
                <h2 className="text-lg font-bold">무엇을 만들어 볼까요?</h2>
                <p className="mt-1 text-sm text-muted">카드를 고르거나, 아래에 만들고 싶은 앱을 자유롭게 설명하세요.</p>
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {STARTERS.map((s) => (
                    <button
                      key={s.title}
                      disabled={!canAsk}
                      onClick={() => setPrompt(s.prompt)}
                      className="card p-3 text-left transition hover:border-accent disabled:opacity-50"
                    >
                      <div className="text-xl">{s.emoji}</div>
                      <div className="mt-1 text-sm font-bold">{s.title}</div>
                      <div className="text-xs text-muted">{s.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Timeline versions={versions} notes={notes} selectedId={selectedId} onSelect={setSelectedId} />

            {busy && pendingPrompt && (
              <div className="ml-8 rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-sm text-accent-fg">{pendingPrompt}</div>
            )}
            {busy && (
              <div className="card p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-accent">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                  {status || "작업 중…"}
                </div>
                {streamText && (
                  <pre className="mt-2 max-h-40 overflow-hidden whitespace-pre-wrap break-all rounded-lg bg-surface-2 p-2 font-mono text-[10.5px] leading-snug text-muted [mask-image:linear-gradient(to_bottom,transparent,black_40%)]">
                    {streamText.slice(-900)}
                  </pre>
                )}
              </div>
            )}
            <div ref={chatEnd} />
          </div>

          {/* 입력 */}
          <form onSubmit={submit} className="border-t border-line bg-surface p-3">
            {versions.length > 0 && active && (
              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                {HINTS.map((h) => (
                  <button type="button" key={h} className="chip shrink-0" disabled={!canAsk} onClick={() => setPrompt(h)}>
                    {h}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                className="input min-h-[52px] flex-1 resize-none text-[15px]"
                rows={Math.min(7, Math.max(2, prompt.split("\n").length, Math.ceil(prompt.length / 30)))}
                placeholder={
                  !active
                    ? "수업이 끝났어요"
                    : me.session.paused
                      ? "강사가 잠시 멈춰 두었어요"
                      : versions.length
                        ? "무엇을 바꿀까요? 예: 합계 아래에 막대 차트를 넣어줘"
                        : "만들고 싶은 앱을 설명해 주세요"
                }
                value={prompt}
                disabled={!active || me.session.paused}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit();
                  }
                }}
                aria-label="AI에게 요청"
              />
              <button className="btn-primary h-[52px] px-5" disabled={!canAsk || !prompt.trim()}>
                {busy ? "…" : versions.length ? "고치기" : "만들기"}
              </button>
            </div>
            {me.remaining === 0 && active && (
              <p className="mt-2 text-xs text-danger">요청 횟수를 다 썼어요. 코드 탭에서 직접 고칠 수 있어요.</p>
            )}
          </form>
        </section>

        <SplitHandle props={chatHandle} dragging={chatDragging} />

        {/* 오른쪽: 앱 */}
        <section className={`${mobilePane === "app" ? "flex" : "hidden"} min-w-0 flex-1 flex-col lg:flex`}>
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
            <div className="flex rounded-xl bg-surface-2 p-1 text-sm">
              {(
                [
                  ["preview", "미리보기"],
                  ["code", "코드"],
                  ["gallery", "갤러리"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`rounded-lg px-3 py-1.5 font-semibold ${tab === k ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {selected && tab !== "gallery" && (
              <>
                <div className="flex items-center gap-1 text-sm">
                  <button
                    className="btn-ghost px-2.5 py-1.5"
                    aria-label="이전 버전"
                    disabled={selectedIndex <= 0}
                    onClick={() => setSelectedId(versions[selectedIndex - 1].id)}
                  >
                    ◀
                  </button>
                  <span className="min-w-16 text-center font-semibold">
                    v{selected.n}
                    <span className="font-normal text-muted">/{versions.length}</span>
                  </span>
                  <button
                    className="btn-ghost px-2.5 py-1.5"
                    aria-label="다음 버전"
                    disabled={selectedIndex >= versions.length - 1}
                    onClick={() => setSelectedId(versions[selectedIndex + 1].id)}
                  >
                    ▶
                  </button>
                </div>
                <div className="ml-auto flex gap-2">
                  {active && (
                    <button className="btn-ghost py-1.5" onClick={shareToGallery}>
                      {me.galleryVersionIds.includes(selected.id) ? "✓ 갤러리에 있음" : "갤러리에 올리기"}
                    </button>
                  )}
                  <button className="btn-primary py-1.5" onClick={() => setShowDownload(true)}>
                    ⬇ 다운로드
                  </button>
                </div>
              </>
            )}
          </div>

          {selected && selectedId !== me.headVersionId && tab !== "gallery" && (
            <div className="border-b border-line bg-warn-soft px-3 py-1.5 text-xs text-warn">
              이전 버전(v{selected.n})을 보고 있어요. 지금 요청하면 이 버전을 바탕으로 고쳐요.
            </div>
          )}

          {previewError && tab === "preview" && (
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-danger-soft px-3 py-2 text-sm text-danger">
              <span className="min-w-0 flex-1 truncate">⚠ 앱에서 오류가 났어요: {previewError}</span>
              {active && (
                <button className="btn-danger py-1" disabled={!canAsk} onClick={() => run("fix", previewError)}>
                  AI로 고치기
                </button>
              )}
              <button className="text-xs underline" onClick={() => setPreviewError(null)}>
                닫기
              </button>
            </div>
          )}

          <div className="min-h-0 flex-1 bg-surface-2">
            {tab === "preview" &&
              (html ? (
                <Preview html={html} storageKey={me.nickname} onError={(m) => setPreviewError((cur) => cur ?? m)} />
              ) : (
                <Empty busy={busy} hasVersions={versions.length > 0} />
              ))}
            {tab === "code" && (
              <CodeTab
                key={`${selectedId}:${html ? "loaded" : "loading"}`}
                html={html ?? ""}
                previewKey={me.nickname}
                editable={active}
                canAsk={canAsk}
                onSaved={adoptVersion}
                onExplain={(q) => run("explain", q)}
                onError={(m) => addNote("danger", m)}
              />
            )}
            {tab === "gallery" && <GalleryTab active={active} onRemix={adoptVersion} onError={(m) => addNote("danger", m)} />}
          </div>
        </section>

        {me.session.paused && active && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-bg/80 backdrop-blur-sm">
            <div className="card max-w-sm p-8 text-center shadow-lg">
              <div className="text-4xl">✋</div>
              <h2 className="mt-3 text-xl font-bold">잠시 화면을 봐 주세요</h2>
              <p className="mt-2 text-sm text-muted">강사가 설명 중이에요. 곧 다시 만들 수 있어요.</p>
            </div>
          </div>
        )}
      </div>

      {chatOverlay}

      {showDownload && selected && (
        <DownloadDialog versions={versions} initialId={selected.id} onClose={() => setShowDownload(false)} />
      )}
    </div>
  );
}

function Timeline({
  versions,
  notes,
  selectedId,
  onSelect,
}: {
  versions: VersionMeta[];
  notes: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const items = [
    ...versions.map((v) => ({ at: v.created_at, kind: "version" as const, v })),
    ...notes.map((n) => ({ at: n.at, kind: "note" as const, n })),
  ].sort((a, b) => a.at - b.at);

  return (
    <>
      {items.map((it, i) =>
        it.kind === "version" ? (
          <div key={it.v.id} className="space-y-2">
            {it.v.prompt && (
              <div className="ml-8 rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-sm text-accent-fg">{it.v.prompt}</div>
            )}
            <button
              onClick={() => onSelect(it.v.id)}
              className={`card block w-full p-3 text-left text-sm transition hover:border-accent ${selectedId === it.v.id ? "border-accent ring-1 ring-accent" : ""}`}
            >
              <div className="mb-1 flex items-center gap-2 text-xs text-muted">
                <span className="rounded bg-surface-2 px-1.5 py-0.5 font-bold text-ink">v{it.v.n}</span>
                <span className="truncate">{it.v.title}</span>
              </div>
              {it.v.summary}
            </button>
          </div>
        ) : (
          <div key={`n${i}`} className="space-y-2">
            {it.n.question && (
              <div className="ml-8 rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-sm text-accent-fg">{it.n.question}</div>
            )}
            <div
              className={`whitespace-pre-wrap rounded-xl p-3 text-sm ${
                it.n.tone === "danger"
                  ? "bg-danger-soft text-danger"
                  : it.n.tone === "warn"
                    ? "bg-warn-soft text-warn"
                    : it.n.tone === "answer"
                      ? "card"
                      : "bg-ok-soft text-ok"
              }`}
            >
              {it.n.tone === "answer" && <div className="mb-1 text-xs font-bold text-accent">💡 코드 설명</div>}
              {it.n.text}
            </div>
          </div>
        ),
      )}
    </>
  );
}

function Empty({ busy, hasVersions }: { busy: boolean; hasVersions: boolean }) {
  return (
    <div className="grid h-full place-items-center p-8 text-center text-muted">
      {busy ? (
        <div>
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <p className="mt-4">AI가 앱을 만들고 있어요…</p>
        </div>
      ) : hasVersions ? (
        <p>불러오는 중…</p>
      ) : (
        <div>
          <div className="text-5xl">🛠️</div>
          <p className="mt-3">왼쪽에서 만들고 싶은 앱을 설명하면 여기에 나타나요.</p>
        </div>
      )}
    </div>
  );
}

function CodeTab({
  html,
  previewKey,
  editable,
  canAsk,
  onSaved,
  onExplain,
  onError,
}: {
  html: string;
  previewKey: string;
  editable: boolean;
  canAsk: boolean;
  onSaved: (v: VersionMeta & { html: string }) => void;
  onExplain: (q: string) => void;
  onError: (m: string) => void;
}) {
  const [code, setCode] = useState(html);
  const [question, setQuestion] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = code !== html;
  const {
    containerRef: codeSplitRef,
    width: codeWidth,
    dragging: codeDragging,
    handleProps: codeHandle,
    overlay: codeOverlay,
  } = useResizable({ storageKey: "ml:codeWidth", defaultWidth: 560, min: 280, maxRatio: 0.8, minRight: 240 });

  // 직접 고치는 코드를 잠깐 멈췄을 때 오른쪽 결과에 반영
  const [livePreview, setLivePreview] = useState(html);
  useEffect(() => {
    const t = setTimeout(() => setLivePreview(code), 600);
    return () => clearTimeout(t);
  }, [code]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (question.trim()) onExplain(question);
            setQuestion("");
          }}
        >
          <input
            className="input py-1.5 text-sm"
            placeholder="코드에 대해 물어보기 — 예: 합계는 어디서 계산해?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={!canAsk || !html}
          />
          <button className="btn-ghost shrink-0 py-1.5" disabled={!canAsk || !question.trim()}>
            설명 듣기
          </button>
        </form>
        {editable && (
          <button
            className="btn-primary py-1.5"
            disabled={!dirty || saving}
            onClick={async () => {
              setSaving(true);
              try {
                const v = await api<VersionMeta>("/api/versions", { body: { html: code } });
                onSaved({ ...v, html: code });
              } catch (e) {
                onError((e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "저장 중…" : "직접 고친 코드 적용"}
          </button>
        )}
      </div>
      <div ref={codeSplitRef} className="flex min-h-0 flex-1" style={{ "--code-w": `${codeWidth}px` } as React.CSSProperties}>
        <textarea
          className="min-h-0 w-full resize-none bg-surface p-4 font-mono text-[12.5px] leading-relaxed text-ink outline-none lg:w-[var(--code-w)] lg:shrink-0"
          spellCheck={false}
          value={code}
          readOnly={!editable}
          onChange={(e) => setCode(e.target.value)}
          aria-label="앱 코드"
        />
        <SplitHandle props={codeHandle} dragging={codeDragging} />
        <div className="hidden min-w-0 flex-1 flex-col lg:flex">
          <div className="border-b border-line bg-surface-2 px-3 py-1 text-xs text-muted">
            결과 {dirty ? "· 고친 코드 미리보기 (아직 적용 전)" : ""}
          </div>
          <div className="min-h-0 flex-1">
            <Preview html={livePreview} storageKey={previewKey} title="코드 결과 미리보기" />
          </div>
        </div>
      </div>
      {codeOverlay}
    </div>
  );
}

function GalleryTab({
  active,
  onRemix,
  onError,
}: {
  active: boolean;
  onRemix: (v: VersionMeta) => void;
  onError: (m: string) => void;
}) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [open, setOpen] = useState<{ item: GalleryItem; html: string } | null>(null);

  useEffect(() => {
    const load = () =>
      api<{ items: GalleryItem[] }>("/api/gallery")
        .then((r) => setItems(r.items))
        .catch(() => {});
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, []);

  if (open) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2 text-sm">
          <button className="btn-ghost py-1.5" onClick={() => setOpen(null)}>
            ← 목록
          </button>
          <b className="truncate">{open.item.title}</b>
          <span className="text-muted">· {open.item.nickname}</span>
          {active && !open.item.mine && (
            <button
              className="btn-primary ml-auto py-1.5"
              onClick={async () => {
                if (!confirm(`'${open.item.title}'을 내 앱으로 가져와 이어서 만들까요? 내 기존 버전은 그대로 남아요.`)) return;
                try {
                  onRemix(await api<VersionMeta>("/api/remix", { body: { galleryId: open.item.id } }));
                } catch (e) {
                  onError((e as Error).message);
                }
              }}
            >
              🔁 리믹스해서 이어 만들기
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1">
          <Preview html={open.html} storageKey={`gallery:${open.item.id}`} title={open.item.title} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className="font-bold">우리 수업 갤러리</h2>
      <p className="mb-4 text-sm text-muted">다른 사람의 앱을 열어 보고, 마음에 들면 리믹스해서 내 버전으로 바꿔 보세요.</p>
      {items.length === 0 ? (
        <p className="py-16 text-center text-muted">아직 올라온 앱이 없어요. 첫 번째로 올려 보세요!</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => (
            <button
              key={it.id}
              className="card p-4 text-left transition hover:border-accent"
              onClick={async () => {
                try {
                  const v = await api<{ html: string }>(`/api/versions/${it.version_id}`);
                  setOpen({ item: it, html: v.html });
                } catch (e) {
                  onError((e as Error).message);
                }
              }}
            >
              <div className="font-bold">{it.title}</div>
              <div className="mt-1 text-sm text-muted">
                {it.nickname}
                {it.mine ? " (나)" : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DownloadDialog({ versions, initialId, onClose }: { versions: VersionMeta[]; initialId: string; onClose: () => void }) {
  const [id, setId] = useState(initialId);
  const v = versions.find((x) => x.id === id);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="card w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">HTML 파일로 내려받기</h2>
        <p className="mt-1 text-sm text-muted">
          파일 하나로 된 앱이에요. 더블클릭하면 브라우저에서 열리고, 메일·메신저로 보내 동료가 그대로 쓸 수 있어요.
        </p>
        <label htmlFor="ver" className="label mt-5">
          버전
        </label>
        <select id="ver" className="input" value={id} onChange={(e) => setId(e.target.value)}>
          {[...versions].reverse().map((x) => (
            <option key={x.id} value={x.id}>
              v{x.n} · {x.title} — {x.summary.slice(0, 30)}
            </option>
          ))}
        </select>
        <ul className="mt-4 space-y-1.5 rounded-xl bg-surface-2 p-3 text-xs text-muted">
          <li>• 차트 같은 외부 라이브러리를 쓰는 앱은 열 때 인터넷 연결이 필요해요.</li>
          <li>• 앱에 저장한 데이터는 파일을 연 브라우저에 따로 저장돼요.</li>
          <li>• 파일 첫머리에 만든 날짜·버전·만든 도구가 표시돼요.</li>
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            닫기
          </button>
          <a className="btn-primary" href={`/api/versions/${id}/download`} download onClick={() => setTimeout(onClose, 300)}>
            ⬇ {v ? `v${v.n}` : ""} 내려받기
          </a>
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          수업이 끝나도 7일 동안은{" "}
          <Link href="/" className="underline">
            복귀 코드
          </Link>
          로 다시 내려받을 수 있어요.
        </p>
      </div>
    </div>
  );
}

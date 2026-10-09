"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import Logo from "@/components/Logo";
import Preview from "@/components/Preview";
import MessagePopup from "@/components/MessagePopup";
import { api, formatDateTime, timeAgo } from "@/lib/client";
import type { Session } from "@/lib/types";

type Row = {
  id: string;
  nickname: string;
  request_count: number;
  version_count: number;
  last_active: number;
  app_title: string;
  head_version_id: string | null;
  error_streak: number;
  stuck: boolean;
};
type Log = { id: number; kind: string; text: string; warn: number; created_at: number; nickname: string | null };
type Gal = { id: string; title: string; version_id: string; created_at: number; nickname: string };
type Dash = {
  session: Session;
  participants: Row[];
  logs: Log[];
  gallery: Gal[];
  usage: { calls: number; input: number; output: number; cost: number };
  serverNow: number;
  expiresAt: number | null;
};

const KRW = 1400;
const MISSIONS = [
  "시작 카드를 하나 골라 첫 앱을 만들어 보세요",
  "색과 글자 크기를 내 취향대로 바꿔 보세요",
  "표나 차트를 하나 넣어 보세요",
  "새로고침해도 데이터가 남게 만들어 보세요",
  "완성한 앱을 갤러리에 올려 보세요",
];
const KIND_LABEL: Record<string, string> = {
  join: "입장",
  create: "생성",
  edit: "수정",
  fix: "오류 수정",
  explain: "코드 질문",
  plan: "아이디어 대화",
  blocked: "차단",
  refused: "AI 거절",
  error: "오류",
  gallery: "갤러리",
  remix: "리믹스",
  manual: "직접 수정",
  mission: "미션",
};

export default function Dashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<Dash | null>(null);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<{ title: string; nickname: string; versionId: string; html: string } | null>(null);
  const [mission, setMission] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async () => {
    try {
      setD(await api<Dash>(`/api/sessions/${id}`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 서버 상태를 불러오는 폴링
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (body: Record<string, unknown>) => {
    try {
      await api(`/api/sessions/${id}`, { method: "PATCH", body });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const view = async (versionId: string) => {
    const v = await api<{ title: string; nickname: string; html: string }>(`/api/versions/${versionId}`);
    setViewing({ ...v, versionId });
  };

  if (error && !d)
    return (
      <div className="grid min-h-screen place-items-center text-center">
        <div>
          <p className="text-danger">{error}</p>
          <Link href="/teacher" className="btn-ghost mt-4">
            수업 목록으로
          </Link>
        </div>
      </div>
    );
  if (!d) return <div className="grid min-h-screen place-items-center text-muted">불러오는 중…</div>;

  const s = d.session;
  const active = s.status === "active";
  const built = d.participants.filter((p) => p.version_count > 0).length;
  const stuck = d.participants.filter((p) => p.stuck);
  const costPct = Math.min(100, (d.usage.cost / s.cost_cap_usd) * 100);
  const minutesLeft = s.ends_at ? Math.round((s.ends_at - d.serverNow) / 60000) : null;

  return (
    <div className="min-h-screen">
      <MessagePopup />
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Logo href="/teacher" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">{s.title}</div>
            <div className="text-xs text-muted">
              {active
                ? minutesLeft !== null
                  ? `진행 중 · ${minutesLeft}분 뒤 자동 종료`
                  : "진행 중"
                : s.status === "ended"
                  ? `종료됨 · ${d.expiresAt ? formatDateTime(d.expiresAt) + "에 결과물 삭제" : ""}`
                  : "만료·삭제됨"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted">강의 코드</div>
            <div className="font-mono text-2xl font-extrabold tracking-[0.25em] text-accent">{s.code}</div>
          </div>
          <Link href="/teacher/guide" target="_blank" className="btn-ghost" title="강사 사용 가이드 (새 창)">
            📖 가이드
          </Link>
          <Link href={`/teacher/${id}/present`} target="_blank" className="btn-primary">
            📺 발표 화면
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5">
        {s.status === "expired" ? (
          <div className="card p-10 text-center text-muted">이 수업은 삭제되어 코드가 영구히 무효가 되었어요. 사용량 보고서만 내려받을 수 있어요.</div>
        ) : (
          <>
            {/* 수업 제어 */}
            <div className="card flex flex-wrap items-center gap-2 p-3">
              {active ? (
                <button className="btn-danger" onClick={() => confirm("수업을 종료할까요? 참여자는 더 만들 수 없고 다운로드만 할 수 있어요. 나중에 재개할 수 있어요.") && act({ action: "end" })}>
                  ■ 수업 종료
                </button>
              ) : (
                <button className="btn-primary" onClick={() => act({ action: "resume" })}>
                  ▶ 수업 재개
                </button>
              )}
              {active && (
                <>
                  <Toggle on={!!s.paused} onLabel="▶ 다시 만들기 허용" offLabel="✋ 전체 일시정지" onClick={() => act({ action: s.paused ? "unpause" : "pause" })} />
                  <Toggle on={!!s.locked} onLabel="🔓 입장 잠금 해제" offLabel="🔒 입장 잠금" onClick={() => act({ action: s.locked ? "unlock" : "lock" })} />
                  <button className="btn-ghost" onClick={() => act({ action: "extend", minutes: 30 })}>
                    +30분 연장
                  </button>
                </>
              )}
              <button className="btn-ghost" onClick={() => setShowSettings((v) => !v)}>
                ⚙ 한도 설정
              </button>
              <div className="ml-auto flex flex-wrap gap-2">
                <a className="btn-ghost" href={`/api/sessions/${id}/report`}>
                  📄 사용량 보고서
                </a>
                {d.gallery.length > 0 && (
                  <a className="btn-ghost" href={`/api/sessions/${id}/gallery-zip`}>
                    🗂 갤러리 ZIP
                  </a>
                )}
                <button
                  className="btn-danger"
                  onClick={() =>
                    confirm("수업을 영구 삭제할까요?\n코드는 즉시 무효가 되고, 참여자 결과물과 기록이 모두 지워져요. 되돌릴 수 없어요.") &&
                    api(`/api/sessions/${id}`, { method: "DELETE" }).then(load)
                  }
                >
                  🗑 삭제
                </button>
              </div>
            </div>

            {showSettings && <Settings s={s} onSave={(b) => act({ action: "settings", ...b }).then(() => setShowSettings(false))} />}

            {/* 미션 */}
            {active && (
              <div className="card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">🎯 미션 방송</span>
                  {s.mission ? (
                    <span className="rounded-lg bg-accent-soft px-2.5 py-1 text-sm text-accent">지금: {s.mission}</span>
                  ) : (
                    <span className="text-sm text-muted">참여자 화면 위쪽에 표시돼요</span>
                  )}
                  {s.mission && (
                    <button className="text-xs text-muted underline" onClick={() => act({ action: "mission", mission: "" })}>
                      내리기
                    </button>
                  )}
                </div>
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (mission.trim()) act({ action: "mission", mission }).then(() => setMission(""));
                  }}
                >
                  <input className="input" placeholder="참여자에게 보낼 미션" value={mission} onChange={(e) => setMission(e.target.value)} />
                  <button className="btn-primary shrink-0">보내기</button>
                </form>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {MISSIONS.map((m) => (
                    <button key={m} className="chip" onClick={() => act({ action: "mission", mission: m })}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 지표 */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="참여" value={`${d.participants.length}`} sub={`정원 ${s.capacity}명`} />
              <Stat label="앱을 만든 사람" value={`${built}`} sub={d.participants.length ? `${Math.round((built / d.participants.length) * 100)}%` : "-"} />
              <Stat label="도움이 필요해 보임" value={`${stuck.length}`} sub="5분 무활동 또는 연속 실패" tone={stuck.length ? "danger" : undefined} />
              <div className="card p-4">
                <div className="text-xs font-semibold text-muted">AI 비용</div>
                <div className="mt-1 text-2xl font-extrabold">
                  ${d.usage.cost.toFixed(2)}
                  <span className="ml-1 text-sm font-normal text-muted">≈ {Math.round(d.usage.cost * KRW).toLocaleString()}원</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className={`h-full ${costPct > 85 ? "bg-danger" : "bg-accent"}`} style={{ width: `${costPct}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted">
                  상한 ${s.cost_cap_usd} · 호출 {d.usage.calls}회
                </div>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
              {/* 진행 현황표 */}
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <h2 className="font-bold">진행 현황</h2>
                  <span className="text-xs text-muted">3초마다 갱신</span>
                </div>
                {d.participants.length === 0 ? (
                  <div className="p-10 text-center text-muted">
                    참여자를 기다리는 중이에요. 발표 화면에 코드 <b className="font-mono text-accent">{s.code}</b>를 띄워 주세요.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-2 text-left text-xs text-muted">
                        <tr>
                          <th className="px-4 py-2 font-semibold">참여자</th>
                          <th className="px-2 py-2 font-semibold">앱</th>
                          <th className="px-2 py-2 text-right font-semibold">요청</th>
                          <th className="px-2 py-2 text-right font-semibold">버전</th>
                          <th className="px-2 py-2 font-semibold">마지막 활동</th>
                          <th className="px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {[...d.participants]
                          .sort((a, b) => Number(b.stuck) - Number(a.stuck))
                          .map((p) => (
                            <tr key={p.id} className={`border-t border-line ${p.stuck ? "bg-danger-soft/60" : ""}`}>
                              <td className="px-4 py-2.5 font-semibold">
                                {p.stuck && <span className="mr-1" title="도움이 필요해 보여요">🆘</span>}
                                {p.nickname}
                              </td>
                              <td className="max-w-48 truncate px-2 py-2.5">{p.app_title || <span className="text-muted">아직 없음</span>}</td>
                              <td className={`px-2 py-2.5 text-right tabular-nums ${p.request_count >= s.per_limit ? "font-bold text-danger" : ""}`}>
                                {p.request_count}/{s.per_limit}
                              </td>
                              <td className="px-2 py-2.5 text-right tabular-nums">{p.version_count}</td>
                              <td className="px-2 py-2.5 text-muted">{timeAgo(p.last_active, d.serverNow)}</td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-right">
                                {p.head_version_id && (
                                  <>
                                    <button className="text-xs font-semibold text-accent hover:underline" onClick={() => view(p.head_version_id!)}>
                                      보기
                                    </button>
                                    <button
                                      className="ml-3 text-xs font-semibold text-accent hover:underline"
                                      onClick={() => act({ action: "spotlight", versionId: p.head_version_id })}
                                    >
                                      📺 띄우기
                                    </button>
                                  </>
                                )}
                                {active && (
                                  <button
                                    className="ml-3 text-xs text-muted hover:text-accent"
                                    title="요청 5회 더 주기"
                                    onClick={() => act({ action: "grant", participantId: p.id, extra: 5 })}
                                  >
                                    +5회
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="space-y-5">
                {/* 갤러리 */}
                <div className="card">
                  <div className="flex items-center justify-between border-b border-line px-4 py-3">
                    <h2 className="font-bold">갤러리 {d.gallery.length > 0 && <span className="text-muted">{d.gallery.length}</span>}</h2>
                    {s.spotlight_version_id && (
                      <button className="text-xs text-muted underline" onClick={() => act({ action: "spotlight", versionId: null })}>
                        발표 화면 비우기
                      </button>
                    )}
                  </div>
                  <ul className="max-h-72 divide-y divide-line overflow-y-auto">
                    {d.gallery.length === 0 && <li className="p-4 text-sm text-muted">아직 올라온 앱이 없어요.</li>}
                    {d.gallery.map((g) => (
                      <li key={g.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">{g.title}</div>
                          <div className="text-xs text-muted">{g.nickname}</div>
                        </div>
                        <button className="text-xs font-semibold text-accent" onClick={() => view(g.version_id)}>
                          보기
                        </button>
                        <button
                          className={`rounded-lg px-2 py-1 text-xs font-semibold ${s.spotlight_version_id === g.version_id ? "bg-accent text-accent-fg" : "bg-surface-2"}`}
                          onClick={() => act({ action: "spotlight", versionId: g.version_id })}
                        >
                          📺
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 활동 기록 */}
                <div className="card">
                  <h2 className="border-b border-line px-4 py-3 font-bold">활동 기록</h2>
                  <ul className="max-h-[420px] divide-y divide-line overflow-y-auto text-sm">
                    {d.logs.length === 0 && <li className="p-4 text-muted">아직 기록이 없어요.</li>}
                    {d.logs.map((l) => (
                      <li key={l.id} className={`px-4 py-2 ${l.warn ? "bg-warn-soft/60" : ""}`}>
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={`rounded px-1.5 py-0.5 font-semibold ${
                              ["blocked", "refused", "error"].includes(l.kind) ? "bg-danger-soft text-danger" : "bg-surface-2"
                            }`}
                          >
                            {KIND_LABEL[l.kind] ?? l.kind}
                          </span>
                          <b>{l.nickname ?? "강사"}</b>
                          <span className="ml-auto text-muted">{timeAgo(l.created_at, d.serverNow)}</span>
                        </div>
                        {l.text && l.kind !== "join" && <div className="mt-1 line-clamp-2 text-muted">{l.text}</div>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {viewing && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/50 p-4 sm:p-8" onClick={() => setViewing(null)}>
          <div className="card mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
              <b className="truncate">{viewing.title}</b>
              <span className="text-sm text-muted">{viewing.nickname}</span>
              <div className="ml-auto flex gap-2">
                <button className="btn-ghost py-1.5" onClick={() => act({ action: "spotlight", versionId: viewing.versionId })}>
                  📺 발표 화면에 띄우기
                </button>
                <a className="btn-ghost py-1.5" href={`/api/versions/${viewing.versionId}/download`}>
                  ⬇
                </a>
                <button className="btn-primary py-1.5" onClick={() => setViewing(null)}>
                  닫기
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <Preview html={viewing.html} storageKey={`t:${viewing.versionId}`} title={viewing.title} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onLabel, offLabel, onClick }: { on: boolean; onLabel: string; offLabel: string; onClick: () => void }) {
  return (
    <button className={on ? "btn-primary" : "btn-ghost"} onClick={onClick}>
      {on ? onLabel : offLabel}
    </button>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "danger" }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold ${tone === "danger" ? "text-danger" : ""}`}>{value}</div>
      <div className="mt-1 text-xs text-muted">{sub}</div>
    </div>
  );
}

function Settings({ s, onSave }: { s: Session; onSave: (b: { perLimit: number; costCapUsd: number; capacity: number }) => void }) {
  const [v, setV] = useState({ perLimit: s.per_limit, costCapUsd: s.cost_cap_usd, capacity: s.capacity });
  return (
    <form
      className="card flex flex-wrap items-end gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v);
      }}
    >
      {(
        [
          ["perLimit", "1인 요청 한도", 1],
          ["costCapUsd", "비용 상한 (USD)", 0.5],
          ["capacity", "정원", 1],
        ] as const
      ).map(([k, label, step]) => (
        <div key={k} className="w-40">
          <label htmlFor={k} className="label text-xs">
            {label}
          </label>
          <input id={k} type="number" step={step} min={0} className="input" value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} />
        </div>
      ))}
      <button className="btn-primary">저장</button>
    </form>
  );
}

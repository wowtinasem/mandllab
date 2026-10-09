"use client";

import { useCallback, useEffect, useState } from "react";
import { api, formatDateTime } from "@/lib/client";
import type { AccessCode } from "@/lib/types";

type CodeRow = AccessCode & { usedBy: string[]; expired: boolean };
type InstructorRow = {
  id: string;
  email: string;
  name: string;
  org: string;
  role: "admin" | "instructor";
  status: "active" | "disabled";
  created_at: number;
  access_code: string | null;
  access_label: string | null;
  session_count: number;
  active_count: number;
};

/** 메인 관리자 전용: 강사 접근 코드 발급과 강사 관리 */
export default function AdminPanel() {
  const [codes, setCodes] = useState<CodeRow[] | null>(null);
  const [instructors, setInstructors] = useState<InstructorRow[] | null>(null);
  const [form, setForm] = useState({ label: "", maxUses: 1, expiresDays: 30 });
  const [issued, setIssued] = useState<{ code: string; label: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    const [c, i] = await Promise.all([
      api<{ codes: CodeRow[] }>("/api/admin/access-codes"),
      api<{ instructors: InstructorRow[] }>("/api/admin/instructors"),
    ]);
    setCodes(c.codes);
    setInstructors(i.instructors);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 서버 목록을 불러온다
    load().catch((e) => setError((e as Error).message));
  }, [load]);

  const issue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const r = await api<{ code: string }>("/api/admin/access-codes", { body: form });
      setIssued({ code: r.code, label: form.label });
      setForm({ label: "", maxUses: 1, expiresDays: 30 });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch {}
  };

  const shareText = (code: string) =>
    `[만들랩 강사 가입 안내]\n1) ${window.location.origin}/teacher 에 접속\n2) "처음이신가요? 강사 가입" 을 누르고\n3) 강사 접근 코드 ${code} 를 입력해 가입해 주세요.`;

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form onSubmit={issue} className="card h-fit space-y-4 p-5">
          <div>
            <h2 className="text-lg font-bold">강사 접근 코드 발급</h2>
            <p className="mt-1 text-xs text-muted">이 코드를 받은 사람만 강사로 가입할 수 있어요. 가입한 강사는 자기가 만든 수업만 봐요.</p>
          </div>
          <div>
            <label htmlFor="label" className="label">
              누구에게 줄 코드인가요?
            </label>
            <input
              id="label"
              className="input"
              placeholder="예: 김OO 강사, OO대학 교육혁신팀"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="maxUses" className="label text-xs">
                가입 가능 인원
              </label>
              <input
                id="maxUses"
                type="number"
                min={1}
                className="input"
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: Number(e.target.value) })}
              />
            </div>
            <div>
              <label htmlFor="days" className="label text-xs">
                사용 기한 (일, 0=무제한)
              </label>
              <input
                id="days"
                type="number"
                min={0}
                className="input"
                value={form.expiresDays}
                onChange={(e) => setForm({ ...form, expiresDays: Number(e.target.value) })}
              />
            </div>
          </div>
          <p className="text-xs text-muted">한 명에게 주려면 인원 1, 강사 여러 명이 함께 쓰면 그 인원수를 넣으세요.</p>
          <button className="btn-primary w-full py-3">접근 코드 만들기</button>

          {issued && (
            <div className="rounded-xl border-2 border-dashed border-accent bg-accent-soft p-4 text-center">
              <div className="text-xs font-semibold text-muted">{issued.label || "새 접근 코드"}</div>
              <div className="mt-1 font-mono text-2xl font-extrabold tracking-wider text-accent">{issued.code}</div>
              <div className="mt-3 flex justify-center gap-2">
                <button type="button" className="btn-ghost py-1.5" onClick={() => copy(issued.code, "new")}>
                  {copied === "new" ? "✓ 복사됨" : "코드 복사"}
                </button>
                <button type="button" className="btn-ghost py-1.5" onClick={() => copy(shareText(issued.code), "share")}>
                  {copied === "share" ? "✓ 복사됨" : "가입 안내문 복사"}
                </button>
              </div>
            </div>
          )}
        </form>

        <div>
          <h2 className="mb-3 text-lg font-bold">발급한 접근 코드</h2>
          {!codes ? (
            <p className="text-muted">불러오는 중…</p>
          ) : codes.length === 0 ? (
            <div className="card p-8 text-center text-muted">아직 발급한 코드가 없어요.</div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2 font-semibold">코드</th>
                    <th className="px-2 py-2 font-semibold">대상</th>
                    <th className="px-2 py-2 font-semibold">가입</th>
                    <th className="px-2 py-2 font-semibold">기한</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => {
                    const expired = c.expired;
                    const full = c.used_count >= c.max_uses;
                    const state = !c.active ? "중지" : expired ? "기한 지남" : full ? "인원 다 참" : "사용 가능";
                    return (
                      <tr key={c.id} className={`border-t border-line ${!c.active || expired ? "text-muted" : ""}`}>
                        <td className="px-4 py-2.5">
                          <button className="font-mono font-bold text-accent hover:underline" title="복사" onClick={() => copy(c.code, c.id)}>
                            {copied === c.id ? "✓ 복사됨" : c.code}
                          </button>
                          <div className="text-xs text-muted">{state}</div>
                        </td>
                        <td className="max-w-48 px-2 py-2.5">
                          <div className="truncate">{c.label || "-"}</div>
                          {c.usedBy.length > 0 && <div className="truncate text-xs text-muted">가입: {c.usedBy.join(", ")}</div>}
                        </td>
                        <td className="px-2 py-2.5 tabular-nums">
                          {c.used_count}/{c.max_uses}
                        </td>
                        <td className="px-2 py-2.5 text-xs">{c.expires_at ? formatDateTime(c.expires_at) : "무제한"}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            className="text-xs font-semibold text-muted hover:text-accent"
                            onClick={() => api(`/api/admin/access-codes/${c.id}`, { method: "PATCH", body: { active: !c.active } }).then(load)}
                          >
                            {c.active ? "사용 중지" : "다시 사용"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">강사 목록</h2>
        {!instructors ? (
          <p className="text-muted">불러오는 중…</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">이름</th>
                  <th className="px-2 py-2 font-semibold">이메일</th>
                  <th className="px-2 py-2 font-semibold">가입 코드</th>
                  <th className="px-2 py-2 text-right font-semibold">수업</th>
                  <th className="px-2 py-2 font-semibold">가입일</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {instructors.map((i) => (
                  <tr key={i.id} className={`border-t border-line ${i.status === "disabled" ? "text-muted" : ""}`}>
                    <td className="px-4 py-2.5 font-semibold">
                      {i.name}
                      {i.role === "admin" && (
                        <span className="ml-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-bold text-accent">메인 관리자</span>
                      )}
                      {i.status === "disabled" && (
                        <span className="ml-1.5 rounded bg-danger-soft px-1.5 py-0.5 text-[11px] font-bold text-danger">중지됨</span>
                      )}
                      {i.org && <div className="text-xs font-normal text-muted">{i.org}</div>}
                    </td>
                    <td className="px-2 py-2.5">{i.email}</td>
                    <td className="px-2 py-2.5 text-xs">
                      {i.access_code ? (
                        <>
                          <span className="font-mono">{i.access_code}</span>
                          {i.access_label && <div className="text-muted">{i.access_label}</div>}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {i.session_count}
                      {i.active_count > 0 && <span className="text-xs text-ok"> (진행 {i.active_count})</span>}
                    </td>
                    <td className="px-2 py-2.5 text-xs">{formatDateTime(i.created_at)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {i.role !== "admin" && (
                        <button
                          className={`text-xs font-semibold ${i.status === "active" ? "text-danger" : "text-accent"} hover:underline`}
                          onClick={() => {
                            const stop = i.status === "active";
                            if (stop && !confirm(`${i.name} 강사를 중지할까요? 바로 로그아웃되고 새 수업을 만들 수 없어요. 이미 만든 수업은 남아요.`)) return;
                            api(`/api/admin/instructors/${i.id}`, { method: "PATCH", body: { active: !stop } })
                              .then(load)
                              .catch((e) => setError((e as Error).message));
                          }}
                        >
                          {i.status === "active" ? "사용 중지" : "다시 허용"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

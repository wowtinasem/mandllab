"use client";

import { useCallback, useEffect, useState } from "react";
import { api, formatDateTime } from "@/lib/client";

type AllowedRow = {
  id: string;
  name: string;
  phone: string;
  phoneText: string;
  org: string;
  memo: string;
  active: number;
  created_at: number;
  instructor_id: string | null;
  email: string | null;
  joined_at: number | null;
  session_count: number;
  active_count: number;
};
type LegacyRow = { id: string; name: string; email: string; org: string; status: string; created_at: number; session_count: number };

/** "김민수, 010-1234-5678, 만들대" 한 줄을 강사 한 명으로 읽는다 (쉼표·탭·여러 칸 띄어쓰기 구분) */
function parseLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split(/\s*[,\t]\s*|\s{2,}/).filter(Boolean);
      if (parts.length === 1) {
        // "김민수 010-1234-5678" 처럼 한 칸만 띄운 경우
        const m = l.match(/^(.+?)\s+(\+?[\d\s-]{9,})$/);
        return m ? { name: m[1], phone: m[2] } : { name: l, phone: "" };
      }
      return { name: parts[0], phone: parts[1] ?? "", org: parts[2] ?? "", memo: parts[3] ?? "" };
    });
}

/** 메인 관리자 전용: 허용 강사 명단 등록과 강사 관리 */
export default function AdminPanel() {
  const [allowed, setAllowed] = useState<AllowedRow[] | null>(null);
  const [legacy, setLegacy] = useState<LegacyRow[]>([]);
  const [one, setOne] = useState({ name: "", phone: "", org: "" });
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [result, setResult] = useState<{ added: string[]; failed: { line: string; reason: string }[] } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const r = await api<{ allowed: AllowedRow[]; legacy: LegacyRow[] }>("/api/admin/instructors");
    setAllowed(r.allowed);
    setLegacy(r.legacy);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 서버 목록을 불러온다
    load().catch((e) => setError((e as Error).message));
  }, [load]);

  const register = async (items: { name: string; phone: string; org?: string; memo?: string }[]) => {
    setError("");
    setResult(null);
    try {
      const r = await api<{ added: string[]; failed: { line: string; reason: string }[] }>("/api/admin/instructors", { body: { items } });
      setResult(r);
      if (r.added.length) {
        setOne({ name: "", phone: "", org: "" });
        setBulk("");
      }
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const act = (path: string, init: { method: string; body?: unknown }) =>
    api(path, init)
      .then(load)
      .catch((e) => setError((e as Error).message));

  const guide = () =>
    `[만들랩 강사 가입 안내]\n1) ${window.location.origin}/teacher 에 접속\n2) "처음이신가요? 강사 가입" 을 누르고\n3) 등록된 이름, 전화번호와 사용할 이메일을 입력하면 가입이 끝나요.\n다음부터는 이름과 전화번호로 바로 로그인할 수 있어요.`;

  const joined = allowed?.filter((a) => a.instructor_id).length ?? 0;

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="card h-fit space-y-4 p-5">
          <div>
            <h2 className="text-lg font-bold">허용 강사 등록</h2>
            <p className="mt-1 text-xs text-muted">
              여기에 등록한 이름·전화번호와 똑같이 입력한 사람만 강사로 가입할 수 있어요. 가입한 강사는 자기가 만든 수업만 봐요.
            </p>
          </div>

          {!showBulk ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                register([one]);
              }}
            >
              <div>
                <label htmlFor="a-name" className="label">
                  강사 이름
                </label>
                <input id="a-name" className="input" placeholder="예: 김민수" value={one.name} onChange={(e) => setOne({ ...one, name: e.target.value })} />
              </div>
              <div>
                <label htmlFor="a-phone" className="label">
                  전화번호
                </label>
                <input
                  id="a-phone"
                  className="input"
                  inputMode="tel"
                  placeholder="010-1234-5678"
                  value={one.phone}
                  onChange={(e) => setOne({ ...one, phone: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="a-org" className="label">
                  소속 (선택)
                </label>
                <input id="a-org" className="input" placeholder="예: 만들대학교" value={one.org} onChange={(e) => setOne({ ...one, org: e.target.value })} />
              </div>
              <button className="btn-primary w-full py-3" disabled={!one.name.trim() || !one.phone.trim()}>
                명단에 등록
              </button>
            </form>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                register(parseLines(bulk));
              }}
            >
              <label htmlFor="a-bulk" className="label">
                여러 명 한 번에 (한 줄에 한 명)
              </label>
              <textarea
                id="a-bulk"
                className="input min-h-40 font-mono text-[13px]"
                placeholder={"김민수, 010-1234-5678, 만들대\n이영희, 010-2222-3333\n박지훈 010 4444 5555"}
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
              />
              <p className="text-xs text-muted">이름, 전화번호, 소속(선택) 순서로 쉼표나 탭으로 구분해요. 엑셀에서 복사해 붙여 넣어도 돼요.</p>
              <button className="btn-primary w-full py-3" disabled={!bulk.trim()}>
                {parseLines(bulk).length || ""}명 등록
              </button>
            </form>
          )}
          <button type="button" className="w-full text-center text-sm text-muted underline" onClick={() => setShowBulk((v) => !v)}>
            {showBulk ? "한 명씩 등록하기" : "여러 명 한 번에 등록하기"}
          </button>

          {result && (
            <div className="space-y-1 rounded-xl bg-surface-2 p-3 text-sm">
              {result.added.length > 0 && <p className="text-ok">✓ {result.added.length}명 등록: {result.added.join(", ")}</p>}
              {result.failed.map((f) => (
                <p key={f.line} className="text-danger">
                  ✕ {f.line} — {f.reason}
                </p>
              ))}
            </div>
          )}

          <button
            type="button"
            className="btn-ghost w-full"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(guide());
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {}
            }}
          >
            {copied ? "✓ 복사됨" : "강사에게 보낼 가입 안내문 복사"}
          </button>
        </div>

        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-bold">허용 강사 명단</h2>
            {allowed && (
              <span className="text-sm text-muted">
                {allowed.length}명 등록 · {joined}명 가입
              </span>
            )}
          </div>
          {!allowed ? (
            <p className="text-muted">불러오는 중…</p>
          ) : allowed.length === 0 ? (
            <div className="card p-8 text-center text-muted">아직 등록한 강사가 없어요. 왼쪽에서 이름과 전화번호를 등록해 주세요.</div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2 font-semibold">이름</th>
                    <th className="px-2 py-2 font-semibold">전화번호</th>
                    <th className="px-2 py-2 font-semibold">가입</th>
                    <th className="px-2 py-2 text-right font-semibold">수업</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {allowed.map((a) => (
                    <tr key={a.id} className={`border-t border-line ${a.active ? "" : "text-muted"}`}>
                      <td className="px-4 py-2.5 font-semibold">
                        {a.name}
                        {!a.active && <span className="ml-1.5 rounded bg-danger-soft px-1.5 py-0.5 text-[11px] font-bold text-danger">중지됨</span>}
                        {a.org && <div className="text-xs font-normal text-muted">{a.org}</div>}
                      </td>
                      <td className="px-2 py-2.5 font-mono text-[13px]">{a.phoneText}</td>
                      <td className="px-2 py-2.5 text-xs">
                        {a.instructor_id ? (
                          <>
                            <span className="font-semibold text-ok">가입 완료</span>
                            <div className="text-muted">{a.email}</div>
                          </>
                        ) : (
                          <span className="text-muted">가입 전</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">
                        {a.session_count}
                        {a.active_count > 0 && <span className="text-xs text-ok"> (진행 {a.active_count})</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs font-semibold">
                        <button
                          className={a.active ? "text-danger hover:underline" : "text-accent hover:underline"}
                          onClick={() => {
                            if (a.active && !confirm(`${a.name} 강사를 중지할까요? 가입했다면 바로 로그아웃되고 로그인할 수 없어요. 이미 만든 수업은 남아요.`)) return;
                            act(`/api/admin/instructors/${a.id}`, { method: "PATCH", body: { active: !a.active } });
                          }}
                        >
                          {a.active ? "사용 중지" : "다시 허용"}
                        </button>
                        {!a.instructor_id && (
                          <button
                            className="ml-3 text-muted hover:text-danger"
                            onClick={() => confirm(`${a.name} 강사를 명단에서 지울까요?`) && act(`/api/admin/instructors/${a.id}`, { method: "DELETE" })}
                          >
                            삭제
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
      </section>

      {legacy.length > 0 && (
        <section>
          <h2 className="text-lg font-bold">명단 없이 예전에 가입한 계정</h2>
          <p className="mb-3 mt-1 text-sm text-muted">
            이름·전화번호 로그인으로 바뀌기 전에 만든 계정이에요. 이제 로그인할 수 없어요. 계속 쓰게 하려면 위 명단에 등록하고 다시 가입하게 해 주세요.
          </p>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {legacy.map((l) => (
                  <tr key={l.id} className="border-t border-line text-muted first:border-t-0">
                    <td className="px-4 py-2.5 font-semibold text-ink">{l.name}</td>
                    <td className="px-2 py-2.5">{l.email}</td>
                    <td className="px-2 py-2.5 text-xs">{formatDateTime(l.created_at)} 가입</td>
                    <td className="px-2 py-2.5 text-right">수업 {l.session_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { api, formatDateTime } from "@/lib/client";

type Due = {
  id: string;
  code: string;
  title: string;
  ended_at: number;
  instructor_name: string | null;
  participant_count: number;
  version_count: number;
};

const DAY = 86_400_000;

/**
 * 메인 관리자 전용: 끝난 지 30일이 지난 수업의 삭제 여부를 묻는 팝업.
 * 자동으로 지우지 않는다. 답하지 않고 닫으면 30일 뒤 다시 묻는다.
 * 메인 관리자가 아니면 아무것도 보이지 않는다.
 */
export default function RetentionPopup() {
  const [due, setDue] = useState<Due[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [nowMs, setNowMs] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await api<{ due: Due[] }>("/api/admin/retention");
      setDue(r.due);
      setNowMs(Date.now());
    } catch {
      setDue([]); // 메인 관리자가 아니면 403 → 보이지 않음
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 화면이 열릴 때 한 번 확인한다
    load();
  }, [load]);

  if (!due.length) return null;

  const answer = async (ids: string[], action: "delete" | "later" | "keep" | "seen") => {
    if (action === "delete" && !confirm(`수업 ${ids.length}개를 삭제할까요?\n학생 결과물과 기록이 지워지고 되돌릴 수 없어요. 필요하면 먼저 "학생 앱 ZIP"을 받아 두세요.`)) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/retention", { body: { ids, action } });
      setDue((cur) => cur.filter((d) => !ids.includes(d.id)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const all = due.map((d) => d.id);

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/40 p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="ret-title">
      <div className="card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 bg-warn-soft px-5 py-3 text-warn">
          <span className="text-xl">🗂</span>
          <b id="ret-title" className="flex-1">
            끝난 지 30일이 지난 수업이 {due.length}개 있어요
          </b>
        </div>
        <div className="space-y-3 overflow-y-auto p-5">
          <p className="text-sm text-muted">
            결과물은 자동으로 지우지 않아요. 수업마다 <b className="text-ink">삭제</b>할지, <b className="text-ink">30일 뒤 다시 물어볼지</b>,{" "}
            <b className="text-ink">계속 보관</b>할지 골라 주세요. 답하지 않고 닫으면 30일 뒤에 다시 알려 드려요.
          </p>
          <ul className="space-y-2.5">
            {due.map((d) => (
              <li key={d.id} className="rounded-xl border border-line p-3.5 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono font-bold text-accent">{d.code}</span>
                  <b className="min-w-0 flex-1 truncate">{d.title}</b>
                  <span className="text-xs text-muted">{d.instructor_name ?? "-"}</span>
                </div>
                <div className="mt-1 text-xs text-muted">
                  {formatDateTime(d.ended_at)} 종료 · {Math.floor((nowMs - d.ended_at) / DAY)}일 지남 · 학생 {d.participant_count}명 · 앱 버전{" "}
                  {d.version_count}개
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {d.participant_count > 0 && (
                    <a className="btn-ghost px-3 py-1.5 text-xs" href={`/api/sessions/${d.id}/apps-zip`}>
                      ⬇ 학생 앱 ZIP
                    </a>
                  )}
                  <button className="btn-danger px-3 py-1.5 text-xs" disabled={busy} onClick={() => answer([d.id], "delete")}>
                    🗑 삭제
                  </button>
                  <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => answer([d.id], "later")}>
                    ⏰ 30일 뒤 다시 묻기
                  </button>
                  <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => answer([d.id], "keep")}>
                    📦 계속 보관
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
          {due.length > 1 && (
            <>
              <button className="btn-danger py-2" disabled={busy} onClick={() => answer(all, "delete")}>
                모두 삭제
              </button>
              <button className="btn-ghost py-2" disabled={busy} onClick={() => answer(all, "later")}>
                모두 30일 뒤 다시 묻기
              </button>
            </>
          )}
          <button className="btn-primary py-2" disabled={busy} onClick={() => answer(all, "seen")}>
            나중에 답하기 (30일 뒤 알림)
          </button>
        </div>
      </div>
    </div>
  );
}

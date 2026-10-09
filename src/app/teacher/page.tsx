"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Logo from "@/components/Logo";
import AdminPanel from "@/components/AdminPanel";
import MessagePopup from "@/components/MessagePopup";
import { api, formatDateTime } from "@/lib/client";
import type { Instructor, Session } from "@/lib/types";
import { formatPhoneInput } from "@/lib/phone";

type SessionRow = Session & { participantCount: number; costUsd: number; instructorName: string; mine: boolean };
type MeResp = { instructor: Instructor | null; mockMode: boolean; dbMissing: boolean };

export default function TeacherHome() {
  const [me, setMe] = useState<MeResp | null>(null);
  const load = useCallback(() => api<MeResp>("/api/instructor/me").then(setMe), []);
  useEffect(() => {
    load();
  }, [load]);

  if (!me) return <div className="grid min-h-screen place-items-center text-muted">불러오는 중…</div>;
  if (!me.instructor) return <AuthForm onDone={load} />;
  return <SessionList instructor={me.instructor} mockMode={me.mockMode} dbMissing={me.dbMissing} onLogout={load} />;
}

type AuthMode = "login" | "signup" | "admin";

function AuthForm({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [f, setF] = useState({ name: "", phone: "", email: "", id: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const go = (m: AuthMode) => {
    setError("");
    setMode(m);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") await api("/api/instructor/signup", { body: { name: f.name, phone: f.phone, email: f.email } });
      else if (mode === "login") await api("/api/instructor/login", { body: { name: f.name, phone: f.phone } });
      else await api("/api/instructor/login", { body: { email: f.id, password: f.password } });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const title = mode === "signup" ? "강사 가입" : mode === "admin" ? "메인 관리자 로그인" : "강사 로그인";
  const desc =
    mode === "signup"
      ? "메인 관리자가 등록해 둔 이름·전화번호와 같게 입력해 주세요. 일치하면 바로 가입돼요."
      : mode === "admin"
        ? "메인 관리자 아이디와 비밀번호로 로그인해요."
        : "가입한 강사는 이름과 전화번호만으로 들어올 수 있어요.";
  // 전화번호는 010-0000-0000 (13자)까지 다 입력해야 버튼이 켜진다
  const ready = mode === "admin" ? f.id.trim() && f.password : f.name.trim() && f.phone.length === 13 && (mode === "login" || f.email.trim());

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <Logo />
      <form onSubmit={submit} className="card mt-10 space-y-4 p-6 sm:p-8">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{desc}</p>
        </div>
        {mode === "admin" ? (
          <>
            <Field id="admin-id" label="아이디" value={f.id} onChange={set("id")} />
            <Field id="admin-pw" label="비밀번호" type="password" value={f.password} onChange={set("password")} />
          </>
        ) : (
          <>
            <Field id="name" label="강사 이름" value={f.name} onChange={set("name")} />
            <Field
              id="phone"
              label="전화번호"
              type="tel"
              placeholder="010-0000-0000"
              maxLength={13}
              value={f.phone}
              onChange={(e) => setF({ ...f, phone: formatPhoneInput(e.target.value) })}
            />
            {mode === "signup" && <Field id="email" label="이메일" type="email" placeholder="연락받을 이메일" value={f.email} onChange={set("email")} />}
          </>
        )}
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <button className="btn-primary w-full py-3" disabled={busy || !ready}>
          {busy ? "확인하는 중…" : mode === "signup" ? "가입하기" : "로그인"}
        </button>
        <div className="space-y-2 text-center text-sm">
          {mode !== "signup" && (
            <button type="button" className="block w-full text-muted hover:text-accent" onClick={() => go("signup")}>
              처음이신가요? <b>강사 가입</b>
            </button>
          )}
          {mode !== "login" && (
            <button type="button" className="block w-full text-muted hover:text-accent" onClick={() => go("login")}>
              강사 로그인으로 돌아가기
            </button>
          )}
          {mode !== "admin" && (
            <button type="button" className="block w-full text-xs text-muted/80 hover:text-accent" onClick={() => go("admin")}>
              메인 관리자 로그인
            </button>
          )}
        </div>
      </form>
      <p className="mt-4 text-center text-xs text-muted">학생은 로그인 없이 첫 화면에서 강의 코드로 들어가요.</p>
    </main>
  );
}

function Field(props: {
  id: string;
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label htmlFor={props.id} className="label">
        {props.label}
      </label>
      <input
        id={props.id}
        className="input"
        type={props.type ?? "text"}
        inputMode={props.type === "tel" ? "tel" : undefined}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        value={props.value}
        onChange={props.onChange}
      />
    </div>
  );
}

const STATUS_LABEL: Record<Session["status"], [string, string]> = {
  active: ["진행 중", "bg-ok-soft text-ok"],
  ended: ["종료", "bg-warn-soft text-warn"],
  expired: ["만료·삭제됨", "bg-surface-2 text-muted"],
};

function SessionList({
  instructor,
  mockMode,
  dbMissing,
  onLogout,
}: {
  instructor: Instructor;
  mockMode: boolean;
  dbMissing: boolean;
  onLogout: () => void;
}) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [form, setForm] = useState({ title: "", perLimit: 60, costCapUsd: 25, capacity: 45, durationMin: 270 });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const admin = instructor.role === "admin";
  const [tab, setTab] = useState<"sessions" | "instructors">("sessions");
  const [onlyMine, setOnlyMine] = useState(false);
  const shown = sessions && (admin && onlyMine ? sessions.filter((s) => s.mine) : sessions);

  const load = useCallback(() => api<{ sessions: SessionRow[] }>("/api/sessions").then((r) => setSessions(r.sessions)), []);
  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const r = await api<{ id: string }>("/api/sessions", { body: form });
      router.push(`/teacher/${r.id}`);
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  };

  const num = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: Number(e.target.value) });

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <MessagePopup />
      <header className="flex items-center justify-between">
        <Logo href="/teacher" />
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">
            <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[11px] font-bold ${admin ? "bg-accent text-accent-fg" : "bg-accent-soft text-accent"}`}>
              {admin ? "메인 관리자" : "강사"}
            </span>
            {instructor.name}
            {instructor.org && ` · ${instructor.org}`}
          </span>
          <Link href="/teacher/guide" className="btn-primary py-1.5">
            📖 사용 가이드
          </Link>
          <button
            className="btn-ghost py-1.5"
            onClick={async () => {
              await api("/api/instructor/logout", { body: {} });
              onLogout();
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      {dbMissing && (
        <div className="mt-6 rounded-xl bg-danger-soft p-4 text-sm text-danger">
          <b>데이터베이스가 연결되지 않았어요.</b> 배포 서버에 Turso가 연결되기 전까지는 수업을 만들 수 없어요. 연결 전에 만든 수업은 사라지고 참여자 입장이 실패해요.
        </div>
      )}

      {mockMode && (
        <div className="mt-6 rounded-xl bg-warn-soft p-4 text-sm text-warn">
          <b>데모 모드</b>로 실행 중이에요. 서버에 <code className="font-mono">GEMINI_API_KEY</code>를 설정하면 실제 AI가 앱을 만들어요. 데모 모드에서는 예시 앱이 나오고 비용이 들지 않아요.
        </div>
      )}

      {admin && (
        <div className="mt-6 flex gap-1 rounded-xl bg-surface-2 p-1 text-sm font-semibold sm:w-fit" role="tablist">
          {(
            [
              ["sessions", "📚 수업"],
              ["instructors", "🧑‍🏫 강사 관리"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`flex-1 rounded-lg px-4 py-2 sm:flex-none ${tab === k ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {admin && tab === "instructors" ? (
        <div className="mt-6">
          <AdminPanel />
        </div>
      ) : (
      <section className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
        <form onSubmit={create} className="card h-fit space-y-4 p-5">
          <h2 className="text-lg font-bold">새 수업 만들기</h2>
          <div>
            <label htmlFor="title" className="label">
              수업 이름
            </label>
            <input
              id="title"
              className="input"
              placeholder="예: 영업팀 업무 자동화 워크숍"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumField id="perLimit" label="1인 요청 한도" value={form.perLimit} onChange={num("perLimit")} />
            <NumField id="capacity" label="정원" value={form.capacity} onChange={num("capacity")} />
            <NumField id="cost" label="비용 상한 (USD)" value={form.costCapUsd} onChange={num("costCapUsd")} step={0.5} />
            <NumField id="dur" label="진행 시간 (분)" value={form.durationMin} onChange={num("durationMin")} />
          </div>
          <p className="text-xs text-muted">
            진행 시간이 지나면 자동으로 종료되고, 종료 7일 뒤 결과물과 기록이 삭제돼요. 코드는 다시 발급되지 않아요.
          </p>
          {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <button className="btn-primary w-full py-3" disabled={creating || !form.title.trim()}>
            {creating ? "만드는 중…" : "수업 만들고 코드 받기"}
          </button>
        </form>

        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{admin ? (onlyMine ? "내 수업" : "전체 수업") : "내 수업"}</h2>
            {admin && (
              <label className="flex items-center gap-1.5 text-sm text-muted">
                <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />내가 만든 것만
              </label>
            )}
          </div>
          {!shown ? (
            <p className="text-muted">불러오는 중…</p>
          ) : shown.length === 0 ? (
            <div className="card p-10 text-center text-muted">아직 만든 수업이 없어요.</div>
          ) : (
            <ul className="space-y-2.5">
              {shown.map((s) => (
                <li key={s.id}>
                  <Link href={`/teacher/${s.id}`} className="card flex flex-wrap items-center gap-x-4 gap-y-1 p-4 transition hover:border-accent">
                    <span className="font-mono text-lg font-extrabold tracking-widest text-accent">{s.code}</span>
                    <span className="min-w-0 flex-1 font-semibold">{s.title}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_LABEL[s.status][1]}`}>
                      {STATUS_LABEL[s.status][0]}
                    </span>
                    <span className="w-full text-xs text-muted sm:w-auto">
                      {admin && <b className="text-ink">{s.mine ? "나" : s.instructorName} · </b>}
                      {formatDateTime(s.created_at)} · {s.participantCount}명 · ${s.costUsd.toFixed(2)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      )}
    </main>
  );
}

function NumField(props: {
  id: string;
  label: string;
  value: number;
  step?: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label htmlFor={props.id} className="label text-xs">
        {props.label}
      </label>
      <input id={props.id} type="number" min={0} step={props.step ?? 1} className="input" value={props.value} onChange={props.onChange} />
    </div>
  );
}

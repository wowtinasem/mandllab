"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { api, formatDateTime } from "@/lib/client";
import type { Instructor, Session } from "@/lib/types";

type SessionRow = Session & { participantCount: number; costUsd: number };
type MeResp = { instructor: Instructor | null; mockMode: boolean; inviteRequired: boolean };

export default function TeacherHome() {
  const [me, setMe] = useState<MeResp | null>(null);
  const load = useCallback(() => api<MeResp>("/api/instructor/me").then(setMe), []);
  useEffect(() => {
    load();
  }, [load]);

  if (!me) return <div className="grid min-h-screen place-items-center text-muted">불러오는 중…</div>;
  if (!me.instructor) return <AuthForm inviteRequired={me.inviteRequired} onDone={load} />;
  return <SessionList instructor={me.instructor} mockMode={me.mockMode} onLogout={load} />;
}

function AuthForm({ inviteRequired, onDone }: { inviteRequired: boolean; onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [f, setF] = useState({ email: "", password: "", name: "", org: "", inviteKey: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api(`/api/instructor/${mode}`, { body: f });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <Logo />
      <form onSubmit={submit} className="card mt-10 space-y-4 p-6 sm:p-8">
        <div>
          <h1 className="text-2xl font-bold">강사 {mode === "login" ? "로그인" : "가입"}</h1>
          <p className="mt-1 text-sm text-muted">수업을 만들고 참여자 진행 상황을 한 화면에서 봐요.</p>
        </div>
        {mode === "signup" && (
          <>
            <Field id="name" label="이름" value={f.name} onChange={set("name")} />
            <Field id="org" label="소속 (기업·대학, 선택)" value={f.org} onChange={set("org")} />
          </>
        )}
        <Field
          id="email"
          label={mode === "login" ? "이메일 (관리자는 아이디)" : "이메일"}
          type={mode === "login" ? "text" : "email"}
          value={f.email}
          onChange={set("email")}
        />
        <Field id="pw" label={mode === "login" ? "비밀번호" : "비밀번호 (8자 이상)"} type="password" value={f.password} onChange={set("password")} />
        {mode === "signup" && inviteRequired && (
          <Field id="invite" label="강사 초대 키" value={f.inviteKey} onChange={set("inviteKey")} />
        )}
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <button className="btn-primary w-full py-3" disabled={busy}>
          {busy ? "처리 중…" : mode === "login" ? "로그인" : "가입하고 시작하기"}
        </button>
        <button
          type="button"
          className="w-full text-sm text-muted hover:text-accent"
          onClick={() => {
            setError("");
            setMode(mode === "login" ? "signup" : "login");
          }}
        >
          {mode === "login" ? "처음이신가요? 강사 가입" : "이미 계정이 있어요 → 로그인"}
        </button>
      </form>
    </main>
  );
}

function Field(props: { id: string; label: string; value: string; type?: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div>
      <label htmlFor={props.id} className="label">
        {props.label}
      </label>
      <input id={props.id} className="input" type={props.type ?? "text"} value={props.value} onChange={props.onChange} />
    </div>
  );
}

const STATUS_LABEL: Record<Session["status"], [string, string]> = {
  active: ["진행 중", "bg-ok-soft text-ok"],
  ended: ["종료", "bg-warn-soft text-warn"],
  expired: ["만료·삭제됨", "bg-surface-2 text-muted"],
};

function SessionList({ instructor, mockMode, onLogout }: { instructor: Instructor; mockMode: boolean; onLogout: () => void }) {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [form, setForm] = useState({ title: "", perLimit: 30, costCapUsd: 20, capacity: 45, durationMin: 180 });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

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
      <header className="flex items-center justify-between">
        <Logo href="/teacher" />
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">
            {instructor.name}
            {instructor.org && ` · ${instructor.org}`}
          </span>
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

      {mockMode && (
        <div className="mt-6 rounded-xl bg-warn-soft p-4 text-sm text-warn">
          <b>데모 모드</b>로 실행 중이에요. 서버에 <code className="font-mono">GEMINI_API_KEY</code>를 설정하면 실제 AI가 앱을 만들어요. 데모 모드에서는 예시 앱이 나오고 비용이 들지 않아요.
        </div>
      )}

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
          <h2 className="mb-3 text-lg font-bold">내 수업</h2>
          {!sessions ? (
            <p className="text-muted">불러오는 중…</p>
          ) : sessions.length === 0 ? (
            <div className="card p-10 text-center text-muted">아직 만든 수업이 없어요.</div>
          ) : (
            <ul className="space-y-2.5">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link href={`/teacher/${s.id}`} className="card flex flex-wrap items-center gap-x-4 gap-y-1 p-4 transition hover:border-accent">
                    <span className="font-mono text-lg font-extrabold tracking-widest text-accent">{s.code}</span>
                    <span className="min-w-0 flex-1 font-semibold">{s.title}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_LABEL[s.status][1]}`}>
                      {STATUS_LABEL[s.status][0]}
                    </span>
                    <span className="w-full text-xs text-muted sm:w-auto">
                      {formatDateTime(s.created_at)} · {s.participantCount}명 · ${s.costUsd.toFixed(2)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
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

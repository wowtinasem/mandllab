"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import Logo from "@/components/Logo";
import ThemePicker from "@/components/ThemePicker";

type Step = "code" | "name" | "saved" | "rejoin";

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [agree, setAgree] = useState(false);
  const [recovery, setRecovery] = useState("");
  const [issued, setIssued] = useState<{ nickname: string; recoveryCode: string; sessionCode: string } | null>(null);
  const [resume, setResume] = useState<{ nickname: string; title: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("code");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 공유 링크(?code=)로 들어온 경우 코드 미리 채우기
    if (q) setCode(q.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
    api<{ nickname: string; session: { title: string } }>("/api/me")
      .then((me) => setResume({ nickname: me.nickname, title: me.session.title }))
      .catch(() => {});
  }, []);

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (code.length !== 6) return setError("강의 코드 6자리를 입력해 주세요.");
    setStep("name");
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await api<{ nickname: string; recoveryCode: string; sessionCode: string }>("/api/join", {
        body: { code, nickname, agree },
      });
      setIssued(r);
      setStep("saved");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const rejoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/api/rejoin", { body: { code, recoveryCode: recovery } });
      router.push("/build");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-3">
          <ThemePicker compact />
          <Link href="/teacher" className="text-sm font-medium text-muted hover:text-accent">
            강사 화면 →
          </Link>
        </div>
      </header>

      <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="mb-3 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
            코딩 몰라도 괜찮아요
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            말로 설명하면
            <br />
            <span className="text-accent">진짜 쓰는 앱</span>이 됩니다
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
            강의 코드 하나로 입장해 AI와 대화하며 견적 계산기, 데이터 정리기, 투표 앱을 만들고 HTML 파일로 가져가세요.
          </p>
          <ol className="mt-8 grid max-w-md gap-3 text-sm">
            {[
              ["1", "강의 코드 입력", "가입·결제 없이 바로 시작"],
              ["2", "말로 만들고 고치기", "\"버튼 더 크게\", \"차트 넣어줘\""],
              ["3", "파일로 가져가기", "더블클릭하면 어디서나 열려요"],
            ].map(([n, t, d]) => (
              <li key={n} className="flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold">{n}</span>
                <span>
                  <b>{t}</b> <span className="text-muted">— {d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="card p-6 shadow-sm sm:p-8">
          {resume && step !== "saved" && (
            <div className="mb-6 flex items-center justify-between gap-3 rounded-xl bg-accent-soft p-4">
              <div className="text-sm">
                <b>{resume.nickname}</b>님, <span className="text-muted">{resume.title}</span> 수업이 이어지고 있어요.
              </div>
              <Link href="/build" className="btn-primary shrink-0">
                이어서 만들기
              </Link>
            </div>
          )}

          {step === "code" && (
            <form onSubmit={submitCode}>
              <label htmlFor="code" className="label">
                강의 코드
              </label>
              <CodeInput id="code" value={code} onChange={setCode} />
              <Err msg={error} />
              <button className="btn-primary mt-5 w-full py-3 text-base" type="submit">
                다음
              </button>
              <button
                type="button"
                className="mt-4 w-full text-center text-sm text-muted hover:text-accent"
                onClick={() => {
                  setError("");
                  setStep("rejoin");
                }}
              >
                다른 기기에서 하던 작업 이어 하기 (복귀 코드)
              </button>
            </form>
          )}

          {step === "name" && (
            <form onSubmit={join}>
              <p className="mb-5 text-sm text-muted">
                강의 코드 <b className="font-mono text-ink">{code}</b>{" "}
                <button type="button" className="underline" onClick={() => setStep("code")}>
                  바꾸기
                </button>
              </p>
              <label htmlFor="nick" className="label">
                이름 또는 별명
              </label>
              <input
                id="nick"
                className="input text-lg"
                maxLength={20}
                autoFocus
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="예: 김민수, 기획팀 민수"
              />
              <p className="mt-1.5 text-xs text-muted">강사와 다른 참여자에게 보여요. 실명이 아니어도 괜찮아요.</p>
              <label className="mt-5 flex items-start gap-2.5 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>
                  만 18세 이상이며{" "}
                  <Link href="/terms" target="_blank" className="font-semibold text-accent underline">
                    이용약관과 개인정보 안내
                  </Link>
                  에 동의합니다.
                </span>
              </label>
              <Err msg={error} />
              <button className="btn-primary mt-6 w-full py-3 text-base" disabled={busy || !nickname.trim() || !agree}>
                {busy ? "입장하는 중…" : "입장하기"}
              </button>
            </form>
          )}

          {step === "saved" && issued && (
            <div>
              <h2 className="text-xl font-bold">{issued.nickname}님, 환영해요! 🎉</h2>
              <p className="mt-2 text-sm text-muted">
                아래 <b className="text-ink">복귀 코드</b>를 적어 두세요. 다른 컴퓨터에서 이어 하거나 수업 뒤 결과물을 내려받을 때 필요해요.
              </p>
              <div className="my-5 rounded-xl border-2 border-dashed border-accent bg-accent-soft p-5 text-center">
                <div className="text-xs font-semibold text-muted">강의 코드 {issued.sessionCode} · 복귀 코드</div>
                <div className="mt-1 font-mono text-3xl font-extrabold tracking-widest text-accent">{issued.recoveryCode}</div>
              </div>
              <button
                className="btn-ghost w-full"
                onClick={() => navigator.clipboard?.writeText(`만들랩 강의 코드 ${issued.sessionCode} / 복귀 코드 ${issued.recoveryCode}`)}
              >
                복사하기
              </button>
              <button className="btn-primary mt-3 w-full py-3 text-base" onClick={() => router.push("/build")}>
                적어 뒀어요, 만들러 가기 →
              </button>
            </div>
          )}

          {step === "rejoin" && (
            <form onSubmit={rejoin}>
              <h2 className="mb-4 text-lg font-bold">하던 작업 이어 하기</h2>
              <label htmlFor="code2" className="label">
                강의 코드
              </label>
              <CodeInput id="code2" value={code} onChange={setCode} />
              <label htmlFor="rec" className="label mt-4">
                복귀 코드
              </label>
              <input
                id="rec"
                className="input font-mono text-lg uppercase tracking-widest"
                placeholder="ABCD-EFGH"
                maxLength={9}
                value={recovery}
                onChange={(e) => setRecovery(e.target.value.toUpperCase())}
              />
              <Err msg={error} />
              <button className="btn-primary mt-5 w-full py-3 text-base" disabled={busy || code.length !== 6 || recovery.length < 8}>
                {busy ? "확인하는 중…" : "이어 하기"}
              </button>
              <button type="button" className="mt-4 w-full text-sm text-muted hover:text-accent" onClick={() => setStep("code")}>
                ← 처음 입장하기
              </button>
            </form>
          )}
        </div>
      </section>

      <footer className="py-4 text-center text-xs text-muted">
        만들랩 · 만 18세 이상 이용 · 이름(별명)만 저장하며 업로드한 파일은 내 브라우저 안에서만 처리돼요
      </footer>
    </main>
  );
}

function CodeInput({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      id={id}
      className="input text-center font-mono text-3xl font-bold uppercase tracking-[0.4em]"
      inputMode="text"
      autoComplete="off"
      autoFocus
      maxLength={6}
      placeholder="••••••"
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
    />
  );
}

function Err({ msg }: { msg: string }) {
  return msg ? (
    <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
      {msg}
    </p>
  ) : null;
}

"use client";

import { useState } from "react";
import type { PlanHistoryItem, PlanQuestion, PlanReply, PlanSpec } from "@/lib/types";

/** 질문으로 시작하기 대화의 한 턴 */
export type PlanTurn =
  | { at: number; role: "user"; text: string }
  | { at: number; role: "ai"; reply: PlanReply; answered?: boolean; built?: boolean };

/** 서버에 보낼 대화 기록 (AI 턴은 질문과 설계안을 글로 풀어서) */
export function toPlanHistory(turns: PlanTurn[]): PlanHistoryItem[] {
  return turns.map((t) => {
    if (t.role === "user") return { role: "user", text: t.text };
    const { message, questions, plan } = t.reply;
    const qs = questions.map((q, i) => `${i + 1}) ${q.question} [${q.options.join(" / ")}]`).join(" ");
    const p = plan ? ` 설계안: ${plan.title} - ${plan.summary} 기능: ${plan.features.join(", ")}` : "";
    return { role: "ai", text: `${message} ${qs}${p}`.trim() };
  });
}

type Answer = { picked: string[]; other: string };

/** AI 질문 카드: 보기를 눌러 고르고 한 번에 답을 보낸다 */
export function PlanQuestionCard({
  reply,
  active,
  disabled,
  onSubmit,
  onSkip,
}: {
  reply: PlanReply;
  active: boolean;
  disabled: boolean;
  onSubmit: (text: string) => void;
  onSkip: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const get = (q: PlanQuestion) => answers[q.id] ?? { picked: [], other: "" };
  const set = (q: PlanQuestion, a: Answer) => setAnswers((cur) => ({ ...cur, [q.id]: a }));

  const toggle = (q: PlanQuestion, opt: string) => {
    const a = get(q);
    if (q.type === "multi") set(q, { ...a, picked: a.picked.includes(opt) ? a.picked.filter((x) => x !== opt) : [...a.picked, opt] });
    else set(q, { ...a, picked: a.picked[0] === opt ? [] : [opt] });
  };

  const answerText = (q: PlanQuestion) => {
    const a = get(q);
    return [...a.picked, a.other.trim()].filter(Boolean).join(", ");
  };
  const answeredCount = reply.questions.filter((q) => answerText(q)).length;

  const submit = () => {
    const lines = reply.questions.map((q, i) => `${i + 1}. ${q.question} → ${answerText(q) || "잘 모르겠어요 (알아서 정해 주세요)"}`);
    onSubmit(lines.join("\n"));
  };

  return (
    <div className="card overflow-hidden">
      <div className="bg-accent-soft px-3.5 py-2.5 text-sm">
        <div className="mb-0.5 text-xs font-bold text-accent">💬 AI 기획 도우미</div>
        {reply.message}
      </div>
      {reply.questions.length > 0 && (
        <fieldset disabled={!active || disabled} className="space-y-4 p-3.5">
          {reply.questions.map((q, i) => {
            const a = get(q);
            return (
              <div key={q.id}>
                <div className="mb-1.5 text-sm font-semibold">
                  Q{i + 1}. {q.question}
                  {q.type === "multi" && <span className="ml-1 text-xs font-normal text-muted">(여러 개 선택)</span>}
                </div>
                {q.options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5" role={q.type === "multi" ? "group" : "radiogroup"}>
                    {q.options.map((opt) => {
                      const on = a.picked.includes(opt);
                      return (
                        <button
                          type="button"
                          key={opt}
                          role={q.type === "multi" ? "checkbox" : "radio"}
                          aria-checked={on}
                          onClick={() => toggle(q, opt)}
                          className={`rounded-xl border px-3 py-1.5 text-left text-[13px] transition disabled:cursor-default ${
                            on ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface hover:border-accent"
                          }`}
                        >
                          {q.type === "multi" ? (on ? "☑ " : "☐ ") : on ? "● " : ""}
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}
                {(q.allowOther || q.type === "text") && (
                  <input
                    className="input mt-1.5 py-1.5 text-[13px]"
                    placeholder={q.type === "text" ? "자유롭게 적어 주세요" : "직접 적기 (선택)"}
                    value={a.other}
                    onChange={(e) => set(q, { ...a, other: e.target.value })}
                  />
                )}
              </div>
            );
          })}
          {active && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className="btn-primary flex-1" disabled={disabled || answeredCount === 0} onClick={submit}>
                답변 보내기 {answeredCount > 0 && `(${answeredCount}/${reply.questions.length})`}
              </button>
              <button type="button" className="btn-ghost" disabled={disabled} onClick={onSkip}>
                이대로 설계안 만들어줘
              </button>
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}

/** 대화가 모이면 나오는 설계안 카드 */
export function PlanSpecCard({
  message,
  plan,
  hasApp,
  disabled,
  built,
  onBuild,
}: {
  message: string;
  plan: PlanSpec;
  hasApp: boolean;
  disabled: boolean;
  built: boolean;
  onBuild: (prompt: string) => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [prompt, setPrompt] = useState(plan.prompt);
  return (
    <div className="card overflow-hidden border-accent">
      <div className="bg-accent-soft px-3.5 py-2.5 text-sm">
        <div className="mb-0.5 text-xs font-bold text-accent">📋 설계안</div>
        {message}
      </div>
      <div className="space-y-3 p-3.5 text-sm">
        <div>
          <div className="text-base font-bold">{plan.title}</div>
          {plan.summary && <p className="mt-0.5 text-muted">{plan.summary}</p>}
        </div>
        {plan.features.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-bold text-muted">{hasApp ? "이번에 바꿀 것" : "첫 버전에 넣을 기능"}</div>
            <ul className="space-y-1">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-1.5">
                  <span className="text-ok">✔</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
        {plan.later.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-bold text-muted">나중에 하나씩 더하면 좋아요</div>
            <ul className="space-y-1 text-muted">
              {plan.later.map((f) => (
                <li key={f}>＋ {f}</li>
              ))}
            </ul>
          </div>
        )}
        <button type="button" className="text-xs text-muted underline" onClick={() => setShowPrompt((v) => !v)}>
          {showPrompt ? "제작 지시문 접기" : "AI에게 보낼 제작 지시문 보기·고치기"}
        </button>
        {showPrompt && (
          <textarea className="input min-h-32 text-[13px]" value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="제작 지시문" />
        )}
        {built ? (
          <p className="rounded-xl bg-ok-soft px-3 py-2 text-center text-sm font-semibold text-ok">✓ 이 설계안으로 만들었어요</p>
        ) : (
          <>
            <button type="button" className="btn-primary w-full py-3" disabled={disabled || !prompt.trim()} onClick={() => onBuild(prompt)}>
              🚀 {hasApp ? "이대로 고치기" : "이대로 만들기"}
            </button>
            <p className="text-center text-xs text-muted">더 바꾸고 싶으면 아래 입력창에 이어서 말해 주세요.</p>
          </>
        )}
      </div>
    </div>
  );
}

import { currentParticipant, newId } from "@/lib/auth";
import { db, now } from "@/lib/db";
import { addLog, sessionCostUsd } from "@/lib/sessions";
import { checkPrompt } from "@/lib/safety";
import { acquireSlot } from "@/lib/queue";
import {
  AiError,
  AiResult,
  applyBlocks,
  buildPrompt,
  callGemini,
  costUsd,
  extractTitle,
  isMockMode,
  parseOutput,
  parsePlanReply,
  pickModel,
} from "@/lib/ai";
import { mockOutput, mockPlan, streamMock } from "@/lib/mock";
import { findBrokenUrls } from "@/lib/urlcheck";
import type { GenerateMode, PlanHistoryItem, StreamEvent, Version, VersionMeta } from "@/lib/types";

export const maxDuration = 300;

const MODES: GenerateMode[] = ["create", "edit", "fix", "explain", "plan"];

export async function POST(req: Request) {
  const me = await currentParticipant();
  if (!me) return Response.json({ error: "다시 입장해 주세요." }, { status: 401 });
  const { participant, session } = me;

  const body = (await req.json().catch(() => ({}))) as {
    mode?: string;
    prompt?: string;
    baseVersionId?: string;
    planHistory?: PlanHistoryItem[];
  };
  // 질문으로 시작하기 대화 기록 (최근 12개, 각 1,500자까지)
  const planHistory: PlanHistoryItem[] = (Array.isArray(body.planHistory) ? body.planHistory : [])
    .slice(-12)
    .map((h) => ({ role: h?.role === "ai" ? ("ai" as const) : ("user" as const), text: String(h?.text ?? "").slice(0, 1500) }))
    .filter((h) => h.text);
  const prompt = String(body.prompt ?? "").trim().slice(0, 4000);
  let mode = (MODES.includes(body.mode as GenerateMode) ? body.mode : "edit") as GenerateMode;
  if (!prompt) return Response.json({ error: "무엇을 만들지 적어 주세요." }, { status: 400 });

  // ── 서버에서 강제하는 조건 ──
  if (session.status !== "active") return Response.json({ error: "수업이 끝나서 더 만들 수 없어요. 다운로드는 할 수 있어요." }, { status: 403 });
  if (session.paused) return Response.json({ error: "강사가 잠시 멈춰 두었어요. 설명을 들어 주세요." }, { status: 423 });
  if (participant.request_count >= session.per_limit)
    return Response.json({ error: "요청 횟수를 모두 썼어요. 코드 탭에서 직접 고치거나 강사에게 문의하세요." }, { status: 429 });
  if (await sessionCostUsd(session.id) >= session.cost_cap_usd)
    return Response.json({ error: "이번 수업의 AI 사용 한도에 도달했어요. 강사에게 알려 주세요." }, { status: 429 });

  const safety = checkPrompt(prompt);
  if (safety.blocked) {
    await addLog(session.id, participant.id, "blocked", prompt, true);
    await db().prepare("UPDATE participants SET error_streak = error_streak + 1, last_active = ? WHERE id = ?").run(now(), participant.id);
    return Response.json({ error: safety.blocked }, { status: 422 });
  }

  // 기준 버전: 지정한 버전(본인 것만) → 없으면 최신 버전
  const baseId = body.baseVersionId || participant.head_version_id;
  const base = baseId
    ? (await db().prepare("SELECT * FROM versions WHERE id = ? AND participant_id = ?").get(baseId, participant.id) as Version | undefined)
    : undefined;
  if (!base && mode !== "create" && mode !== "plan") mode = mode === "explain" ? "explain" : "create";
  if (mode === "explain" && !base) return Response.json({ error: "설명할 앱이 아직 없어요." }, { status: 400 });

  const history = (
    await db()
      .prepare("SELECT prompt FROM versions WHERE participant_id = ? AND prompt != '' ORDER BY n DESC LIMIT 5")
      .all(participant.id) as { prompt: string }[]
  )
    .map((r) => r.prompt.slice(0, 200))
    .reverse();

  // 횟수는 먼저 차감하고, AI 쪽 장애로 실패하면 돌려준다
  await db().prepare("UPDATE participants SET request_count = request_count + 1, last_active = ? WHERE id = ?").run(now(), participant.id);
  const remainingAfter = session.per_limit - participant.request_count - 1;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (ev: StreamEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
        } catch {
          open = false; // 브라우저가 떠나도 생성과 저장은 끝까지 한다
        }
      };

      for (const w of safety.warnings) send({ t: "warn", d: w });
      send({ t: "status", d: "요청을 보내는 중…" });

      const release = await acquireSlot((pos) => send({ t: "status", d: `차례를 기다리는 중… (앞에 ${pos}명)` }));
      try {
        send({
          t: "status",
          d: mode === "plan" ? "생각을 정리하는 중…" : mode === "explain" ? "코드를 읽는 중…" : mode === "create" ? "앱을 만드는 중…" : "고치는 중…",
        });

        // override: 자동 고치기처럼 학생 요청과 다른 지시로 한 번 더 부를 때 쓴다
        const run = async (
          fullRewrite: boolean,
          override?: { mode: GenerateMode; prompt: string; baseHtml: string },
        ): Promise<AiResult & { model: string }> => {
          const m = override?.mode ?? mode;
          const p = override?.prompt ?? prompt;
          const baseHtml = override ? override.baseHtml : base?.html;
          const model = pickModel(m, p);
          const { system, user } = buildPrompt({ mode: m, prompt: p, baseHtml, history: override ? [] : history, fullRewrite, planHistory });
          // 질문 모드의 JSON 은 화면에 흘려 보여주지 않는다
          const onDelta = m === "plan" ? () => {} : (d: string) => send({ t: "delta", d });
          const mock = () =>
            m === "plan"
              ? mockPlan(p, planHistory.filter((h) => h.role === "user").length, Boolean(base))
              : mockOutput(m, p, baseHtml, fullRewrite);
          const r = isMockMode() ? await streamMock(mock(), onDelta) : await callGemini(model, system, user, onDelta, undefined, m === "plan");
          await db()
            .prepare(
              "INSERT INTO usage (session_id, participant_id, model, input_tokens, output_tokens, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .run(session.id, participant.id, model, r.inputTokens, r.outputTokens, costUsd(model, r.inputTokens, r.outputTokens), now());
          return { ...r, model };
        };

        if (mode === "plan") {
          const plan = parsePlanReply((await run(false)).text);
          if (!plan) throw new AiError("unparseable plan", "AI 답변을 정리하지 못했어요. 한 번 더 보내 주세요.");
          await addLog(session.id, participant.id, "plan", plan.plan ? `설계안: ${plan.plan.title}` : prompt);
          send({ t: "done", plan, summary: "", remaining: remainingAfter });
          return;
        }

        if (mode === "explain") {
          const r = await run(false);
          await addLog(session.id, participant.id, "explain", prompt);
          send({ t: "done", answer: r.text.trim(), summary: "", remaining: remainingAfter });
          return;
        }

        let out = parseOutput((await run(false)).text);
        let html: string | null = null;

        if (out.kind === "refused") {
          await addLog(session.id, participant.id, "refused", `${prompt} → ${out.reason}`, true);
          await db().prepare("UPDATE participants SET error_streak = error_streak + 1 WHERE id = ?").run(participant.id);
          send({ t: "refused", d: out.reason, remaining: remainingAfter });
          return;
        }
        if (out.kind === "diff" && base) html = applyBlocks(base.html, out.blocks);
        if (out.kind === "full") html = out.html;

        if (html === null && base) {
          // 변경분 적용 실패 → 전체 재작성으로 한 번 더 (추가 요청 횟수는 차감하지 않음)
          send({ t: "status", d: "수정 위치를 다시 맞추는 중…" });
          send({ t: "delta", d: "\n\n<!-- 전체 다시 쓰기 -->\n" });
          out = parseOutput((await run(true)).text);
          if (out.kind === "full") html = out.html;
          if (out.kind === "diff") html = applyBlocks(base.html, out.blocks);
        }
        if (html === null) {
          throw new AiError("unparseable output", "AI 답변을 앱으로 바꾸지 못했어요. 요청을 조금 바꿔 다시 시도해 주세요.");
        }

        // AI가 없는 라이브러리 주소를 쓰면 앱이 멈춘다. 외부 주소를 실제로 열어 보고, 없는 주소가 있으면 한 번 자동으로 고친다 (요청 횟수 차감 없음)
        if (!isMockMode()) {
          const broken = await findBrokenUrls(html);
          if (broken.length) {
            send({ t: "status", d: "불러오지 못하는 라이브러리 주소를 고치는 중…" });
            send({ t: "delta", d: "\n\n<!-- 라이브러리 주소 자동 고치기 -->\n" });
            const fixPrompt = `이 앱이 불러오는 다음 외부 주소는 존재하지 않아(404) 앱이 동작하지 않는다.\n${broken.join("\n")}\n검증된 라이브러리 목록의 주소로 바꾸고, 바뀐 라이브러리의 사용법에 맞게 코드도 함께 고쳐라. 목록에 없는 기능이면 라이브러리 없이 직접 구현하라. 다른 부분은 바꾸지 않는다.`;
            try {
              const fixed = parseOutput((await run(false, { mode: "edit", prompt: fixPrompt, baseHtml: html })).text);
              const repaired = fixed.kind === "diff" ? applyBlocks(html, fixed.blocks) : fixed.kind === "full" ? fixed.html : null;
              if (repaired) html = repaired;
              await addLog(session.id, participant.id, "autofix", `라이브러리 주소 자동 고침: ${broken.join(", ")}`);
            } catch (e) {
              console.error("[generate] autofix failed", e); // 고치기에 실패해도 학생 요청 결과는 그대로 저장한다
            }
          }
        }

        const summary = ("summary" in out && out.summary) || "요청을 반영했어요.";
        const version: Version = {
          id: newId(),
          participant_id: participant.id,
          session_id: session.id,
          n: participant.version_count + 1,
          html,
          title: extractTitle(html),
          summary,
          prompt: mode === "fix" ? `오류 고치기: ${prompt.slice(0, 120)}` : prompt,
          created_at: now(),
        };
        await db()
          .prepare("INSERT INTO versions (id, participant_id, session_id, n, html, title, summary, prompt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(version.id, version.participant_id, version.session_id, version.n, version.html, version.title, version.summary, version.prompt, version.created_at);
        await db()
          .prepare(
            "UPDATE participants SET version_count = ?, head_version_id = ?, app_title = ?, error_streak = 0, last_active = ? WHERE id = ?",
          )
          .run(version.n, version.id, version.title, now(), participant.id);
        await addLog(session.id, participant.id, mode, prompt, safety.warnings.length > 0);

        const { html: _omit, ...meta } = version;
        void _omit;
        send({ t: "done", version: meta as VersionMeta, summary, remaining: remainingAfter });
      } catch (e) {
        const userMessage = e instanceof AiError ? e.userMessage : "알 수 없는 오류가 났어요. 다시 시도해 주세요.";
        console.error("[generate]", e);
        await db().prepare("UPDATE participants SET request_count = MAX(0, request_count - 1), error_streak = error_streak + 1 WHERE id = ?").run(participant.id);
        await addLog(session.id, participant.id, "error", `${prompt} → ${e instanceof Error ? e.message.slice(0, 200) : "unknown"}`, true);
        send({ t: "error", d: userMessage });
      } finally {
        release();
        open = false;
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}

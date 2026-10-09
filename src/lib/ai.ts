import "server-only";
import type { GenerateMode, PlanHistoryItem, PlanQuestion, PlanReply } from "./types";
import { IMAGE_GUIDE, LIBRARY_GUIDE } from "./catalog";

// ───────────────────────── 모델과 단가 ─────────────────────────

export const MODEL_GEN = process.env.GEMINI_MODEL_GEN || "gemini-3.8-flash";
export const MODEL_LITE = process.env.GEMINI_MODEL_LITE || "gemini-3.1-flash-lite";
export const MOCK_MODEL = "demo-mode";

export const isMockMode = () => !process.env.GEMINI_API_KEY;

function parsePrice(env: string | undefined, fallback: [number, number]): [number, number] {
  const parts = env?.split(",").map(Number);
  return parts && parts.length === 2 && parts.every((n) => Number.isFinite(n)) ? [parts[0], parts[1]] : fallback;
}

/** 100만 토큰당 [입력, 출력] 달러. 출력에는 생각 토큰이 포함된다. */
export function priceOf(model: string): [number, number] {
  if (model === MOCK_MODEL) return [0, 0];
  if (model === MODEL_LITE) return parsePrice(process.env.GEMINI_PRICE_LITE, [0.25, 1.5]);
  return parsePrice(process.env.GEMINI_PRICE_GEN, [0.75, 3.75]);
}

export function costUsd(model: string, input: number, output: number): number {
  const [pi, po] = priceOf(model);
  return (input * pi + output * po) / 1_000_000;
}

/** 첫 생성과 일반 수정은 Flash, 오류 수정·코드 설명·짧은 수정은 Flash-Lite */
export function pickModel(mode: GenerateMode, prompt: string): string {
  if (isMockMode()) return MOCK_MODEL;
  if (mode === "create") return MODEL_GEN;
  if (mode === "fix" || mode === "explain") return MODEL_LITE;
  if (mode === "plan") return MODEL_GEN;
  return prompt.trim().length <= 25 ? MODEL_LITE : MODEL_GEN;
}

// ───────────────────────── 프롬프트 ─────────────────────────

const COMMON_RULES = `너는 '만들랩'의 웹 앱 제작 도우미다. 사용자는 코딩을 모르는 직장인·대학생이며, 강의 시간 안에 실제로 쓸 수 있는 앱을 만들고 싶어 한다.

[결과물 규칙]
- 결과물은 파일 하나만으로 브라우저에서 바로 열리는 단일 HTML 문서다. CSS와 JS는 문서 안에 인라인으로 넣는다.
- 외부 라이브러리는 jsDelivr, cdnjs, unpkg 같은 주요 CDN에서 <script>/<link>로 불러와도 된다. 아래 "검증된 라이브러리 목록"의 주소를 우선 쓰고, 목록에 없는 라이브러리는 확실히 존재하는 주소와 버전만 쓴다. 확실하지 않으면 라이브러리 없이 직접 구현한다.
- 키가 필요 없는 공개 API는 fetch로 호출해도 된다. API 키·비밀번호가 필요한 서비스는 코드에 키를 넣지 말고, 요약에서 그 점을 알린다.
- 여러 화면은 한 파일 안에서 화면 전환으로 만든다. localStorage 저장, 파일 업로드(FileReader, CSV·엑셀 읽기)를 써도 된다.
- 화면 글자는 한국어. 깔끔하고 현대적인 디자인, 노트북과 휴대폰 모두에서 보기 좋은 반응형, 충분한 글자 대비, 입력칸에는 라벨.
- <title>에는 짧은 한국어 앱 이름을 넣는다.
- 마크다운 코드 블록(\`\`\`)이나 HTML 밖의 설명 문장을 쓰지 않는다.

${LIBRARY_GUIDE}

${IMAGE_GUIDE}

[응답 첫 줄]
- 반드시 <!-- 요약: ... --> 한 줄로 시작한다. 무엇을 만들었거나 바꿨는지 비개발자도 이해하게 1~2문장으로 쓴다.

[거절]
- 악성코드, 피싱 페이지, 실제 서비스 로그인 화면 흉내, 불법 목적의 요청이면 HTML 없이 <!-- 거절: 이유 --> 한 줄만 쓴다.`;

const CREATE_RULES = `${COMMON_RULES}

[출력 형식]
<!-- 요약: ... -->
<!DOCTYPE html>
...완전한 문서...
</html>`;

const EDIT_RULES = `${COMMON_RULES}

[수정 방식] 현재 코드에서 바뀌는 부분만 아래 블록으로 출력한다. 블록은 여러 개 써도 된다.
<!-- 요약: ... -->
<<<<<<< SEARCH
(현재 코드에서 공백·들여쓰기까지 그대로 복사한, 문서 안에서 딱 한 곳과 일치하는 연속된 줄)
=======
(바뀐 코드)
>>>>>>> REPLACE

- SEARCH 부분은 짧게, 그러나 한 곳에만 일치하도록 앞뒤 줄을 포함한다.
- 문서의 절반 이상이 바뀌는 큰 변경이면 블록 대신 <!-- 요약 --> 다음에 완전한 HTML 문서 전체를 출력해도 된다.`;

const FULL_REWRITE_RULES = `${COMMON_RULES}

[수정 방식] 현재 코드에 요청을 반영한 완전한 HTML 문서 전체를 출력한다.
<!-- 요약: ... -->
<!DOCTYPE html>
...`;

const EXPLAIN_RULES = `너는 '만들랩'의 친절한 코딩 선생님이다. 사용자는 코딩을 모르는 직장인·대학생이다.
사용자가 가진 웹 앱 코드에 대한 질문에 한국어로 쉽고 짧게(10줄 이내) 답한다. 필요하면 코드의 짧은 일부를 인용해도 되지만 전체 코드를 다시 쓰지 않는다.
비유를 쓰고, 전문 용어가 나오면 괄호로 풀어 쓴다.`;

const PLAN_RULES = `너는 '만들랩'의 친절한 앱 기획 도우미다. 사용자는 코딩을 모르는 직장인·대학생이며, 무엇을 어떻게 만들지 아이디어가 아직 적다.
짧은 대화로 아이디어를 구체화해서, 파일 하나로 된 웹 앱(HTML) 설계안을 함께 만든다.

[출력] 반드시 아래 모양의 JSON 하나만 출력한다. 다른 글, 코드 블록 표시(\`\`\`)를 쓰지 않는다.
{
  "message": "사용자 생각에 공감하고 지금 무엇을 하는지 알려주는 1~2문장",
  "questions": [
    { "id": "q1", "question": "쉬운 말로 된 질문", "type": "single", "options": ["보기1", "보기2", "보기3"], "allowOther": true }
  ],
  "plan": null
}
- type: 하나만 고르면 "single", 여러 개 고를 수 있으면 "multi", 직접 적어야 하면 "text"(options는 빈 배열)
- allowOther: 보기에 없는 답을 직접 적을 수 있게 하려면 true

[질문하는 법]
- 한 번에 질문 2~4개, 보기는 3~5개. 고르기 쉬운 구체적인 보기를 준다. 전문 용어를 쓰지 않는다.
- 중요한 것부터 묻는다: 누가·왜 쓰는지 → 꼭 필요한 기능 → 화면 모습 → 저장·내보내기.
- 사용자가 이미 말한 내용은 다시 묻지 않는다.

[설계안을 낼 때]
다음 중 하나면 questions 를 빈 배열로 하고 plan 을 채운다.
- 사용자의 답변을 두 번 받았을 때 (더 묻지 말고 정리한다)
- 이미 정보가 충분할 때
- 사용자가 "바로 만들어", "알아서 해줘", "이대로 정리" 같은 말을 했을 때
"plan": {
  "title": "짧은 한국어 앱 이름",
  "summary": "어떤 앱인지 한두 문장",
  "features": ["첫 버전에 넣을 핵심 기능 3~6개. 작게 시작한다"],
  "later": ["나중에 하나씩 추가하면 좋은 기능 2~3개"],
  "prompt": "제작 AI에게 그대로 보낼 구체적인 한국어 제작 지시문 (300~800자). 화면 구성, 기능, 저장 방식(localStorage 등), 디자인 분위기를 담는다."
}

[현재 앱이 있을 때]
- 현재 앱을 바탕으로 무엇을 더하거나 바꿀지 묻는다.
- plan.prompt 는 현재 앱을 고치는 지시문으로 쓴다 ("지금 앱에 ~을 추가해줘" 식으로).

[거절] 악성코드, 피싱, 불법 목적이면 questions 는 빈 배열, plan 은 null, message 에 정중히 이유를 쓴다.`;

export interface PromptInput {
  mode: GenerateMode;
  prompt: string;
  baseHtml?: string;
  history: string[];
  fullRewrite?: boolean;
  planHistory?: PlanHistoryItem[];
}

export function buildPrompt({ mode, prompt, baseHtml, history, fullRewrite, planHistory }: PromptInput): {
  system: string;
  user: string;
} {
  const hist = history.length ? `[지금까지의 요청]\n${history.map((h, i) => `${i + 1}. ${h}`).join("\n")}\n\n` : "";
  if (mode === "plan") {
    const talk = (planHistory ?? []).map((h) => `${h.role === "user" ? "사용자" : "도우미"}: ${h.text}`).join("\n");
    const app = baseHtml ? `[현재 앱 코드]\n${baseHtml.slice(0, 30000)}\n\n` : "[현재 앱] 아직 없음\n\n";
    const convo = talk ? `[지금까지의 대화]\n${talk}\n\n` : "";
    return { system: PLAN_RULES, user: `${app}${convo}[사용자의 새 말]\n${prompt}` };
  }
  if (mode === "explain") {
    return { system: EXPLAIN_RULES, user: `[현재 코드]\n${baseHtml ?? ""}\n\n[질문]\n${prompt}` };
  }
  if (mode === "create" || !baseHtml) {
    return { system: CREATE_RULES, user: `[만들고 싶은 앱]\n${prompt}` };
  }
  const ask = mode === "fix" ? `앱을 실행하니 아래 오류가 났다. 원인을 찾아 고쳐라.\n${prompt}` : prompt;
  return {
    system: fullRewrite ? FULL_REWRITE_RULES : EDIT_RULES,
    user: `${hist}[현재 코드]\n${baseHtml}\n\n[이번 요청]\n${ask}`,
  };
}

// ───────────────────────── Gemini 호출 ─────────────────────────

export interface AiResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export class AiError extends Error {
  userMessage: string;
  constructor(message: string, userMessage: string) {
    super(message);
    this.userMessage = userMessage;
  }
}

export async function callGemini(
  model: string,
  system: string,
  user: string,
  onDelta: (s: string) => void,
  signal?: AbortSignal,
  json = false,
): Promise<AiResult> {
  const thinkingLevel = process.env.GEMINI_THINKING_LEVEL ?? "low";
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      maxOutputTokens: json ? 4096 : 32768,
      ...(json ? { responseMimeType: "application/json" } : {}),
      ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
    },
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify(body),
      signal,
    },
  );
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    const userMessage =
      res.status === 429
        ? "지금 요청이 몰려 AI가 잠시 쉬고 있어요. 30초 뒤에 다시 눌러 주세요."
        : res.status >= 500
          ? "AI 서비스에 일시적인 문제가 있어요. 잠시 뒤 다시 시도해 주세요."
          : "AI 요청을 처리하지 못했어요. 강사에게 알려 주세요.";
    throw new AiError(`Gemini ${res.status}: ${detail.slice(0, 500)}`, userMessage);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (!json || json === "[DONE]") continue;
      let chunk: GeminiChunk;
      try {
        chunk = JSON.parse(json);
      } catch {
        continue;
      }
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        if (part.thought || !part.text) continue;
        text += part.text;
        onDelta(part.text);
      }
      const u = chunk.usageMetadata;
      if (u) {
        inputTokens = u.promptTokenCount ?? inputTokens;
        outputTokens = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) || outputTokens;
      }
      const block = chunk.promptFeedback?.blockReason;
      if (block) throw new AiError(`blocked: ${block}`, "AI가 이 요청을 처리하지 않았어요. 표현을 바꿔 다시 요청해 주세요.");
    }
  }
  return { text, inputTokens, outputTokens };
}

interface GeminiChunk {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  promptFeedback?: { blockReason?: string };
}

// ───────────────────────── 응답 해석과 변경분 적용 ─────────────────────────

export type ParsedOutput =
  | { kind: "refused"; reason: string }
  | { kind: "full"; summary: string; html: string }
  | { kind: "diff"; summary: string; blocks: { search: string; replace: string }[] }
  | { kind: "invalid"; summary: string };

const BLOCK_RE = /<{7} SEARCH\r?\n([\s\S]*?)\r?\n={7}\r?\n([\s\S]*?)\r?\n?>{7} REPLACE/g;

export function parseOutput(raw: string): ParsedOutput {
  const text = raw.replace(/^\s*```[a-zA-Z]*\s*$/gm, "").trim();
  const refusal = text.match(/^<!--\s*거절\s*:\s*([\s\S]*?)-->/);
  if (refusal) return { kind: "refused", reason: refusal[1].trim() };

  const sm = text.match(/<!--\s*요약\s*:\s*([\s\S]*?)-->/);
  const summary = sm ? sm[1].trim() : "";
  const body = sm ? text.replace(sm[0], "").trim() : text;

  if (body.includes("<<<<<<< SEARCH")) {
    const blocks = [...body.matchAll(BLOCK_RE)].map((m) => ({ search: m[1], replace: m[2] }));
    return blocks.length ? { kind: "diff", summary, blocks } : { kind: "invalid", summary };
  }
  const start = body.search(/<!DOCTYPE html|<html/i);
  const end = body.toLowerCase().lastIndexOf("</html>");
  if (start >= 0) {
    const html = end > start ? body.slice(start, end + 7) : body.slice(start);
    return { kind: "full", summary, html };
  }
  return { kind: "invalid", summary };
}

/** 블록을 차례로 적용한다. 하나라도 위치를 못 찾으면 null (호출 쪽에서 전체 재작성으로 되돌림). */
export function applyBlocks(base: string, blocks: { search: string; replace: string }[]): string | null {
  let doc = base;
  for (const { search, replace } of blocks) {
    const at = doc.indexOf(search);
    if (at >= 0) {
      doc = doc.slice(0, at) + replace + doc.slice(at + search.length);
      continue;
    }
    const fuzzy = replaceByTrimmedLines(doc, search, replace);
    if (fuzzy === null) return null;
    doc = fuzzy;
  }
  return doc;
}

// 들여쓰기·줄 끝 공백 차이만 있는 경우를 허용
function replaceByTrimmedLines(doc: string, search: string, replace: string): string | null {
  const lines = doc.split("\n");
  const want = search.split("\n").map((l) => l.trim());
  while (want.length && !want[want.length - 1]) want.pop();
  while (want.length && !want[0]) want.shift();
  if (!want.length) return null;
  for (let i = 0; i + want.length <= lines.length; i++) {
    let ok = true;
    for (let j = 0; j < want.length; j++) {
      if (lines[i + j].trim() !== want[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return [...lines.slice(0, i), replace, ...lines.slice(i + want.length)].join("\n");
  }
  return null;
}

export function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return (m?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || "제목 없는 앱";
}

// ───────────────────────── 질문으로 시작하기 응답 해석 ─────────────────────────

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strList = (v: unknown, n: number, max: number) =>
  Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : [];

/** AI가 준 JSON 을 안전한 모양으로 다듬는다. 해석할 수 없으면 null */
export function parsePlanReply(raw: string): PlanReply | null {
  const text = raw.replace(/^\s*```[a-zA-Z]*\s*$/gm, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const questions: PlanQuestion[] = (Array.isArray(data.questions) ? data.questions : [])
    .slice(0, 5)
    .map((q: Record<string, unknown>, i: number) => {
      const type = q.type === "multi" || q.type === "text" ? q.type : "single";
      return {
        id: str(q.id, 20) || `q${i + 1}`,
        question: str(q.question, 200),
        type,
        options: type === "text" ? [] : strList(q.options, 6, 80),
        allowOther: type === "text" ? true : q.allowOther !== false,
      } as PlanQuestion;
    })
    .filter((q: PlanQuestion) => q.question && (q.type === "text" || q.options.length > 0));
  const p = data.plan as Record<string, unknown> | null | undefined;
  const plan =
    p && typeof p === "object" && str(p.prompt, 3000)
      ? {
          title: str(p.title, 60) || "나의 앱",
          summary: str(p.summary, 300),
          features: strList(p.features, 8, 120),
          later: strList(p.later, 4, 120),
          prompt: str(p.prompt, 3000),
        }
      : null;
  const message = str(data.message, 500);
  if (!message && !questions.length && !plan) return null;
  return { message, questions: plan ? [] : questions, plan };
}

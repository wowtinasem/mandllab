export type SessionStatus = "active" | "ended" | "expired";

export type InstructorRole = "admin" | "instructor";

export interface Instructor {
  id: string;
  email: string;
  name: string;
  org: string;
  role: InstructorRole;
}

export interface AllowedInstructor {
  id: string;
  name: string;
  phone: string;
  org: string;
  memo: string;
  active: number;
  instructor_id: string | null;
  created_at: number;
}

export interface Session {
  id: string;
  code: string;
  title: string;
  instructor_id: string;
  status: SessionStatus;
  per_limit: number;
  cost_cap_usd: number;
  capacity: number;
  locked: number;
  paused: number;
  mission: string;
  spotlight_version_id: string | null;
  ends_at: number | null;
  ended_at: number | null;
  created_at: number;
}

export interface Participant {
  id: string;
  session_id: string;
  nickname: string;
  recovery_hash: string;
  token_hash: string;
  adult_terms_at: number;
  request_count: number;
  error_streak: number;
  last_active: number;
  app_title: string;
  version_count: number;
  head_version_id: string | null;
  created_at: number;
}

export interface Version {
  id: string;
  participant_id: string;
  session_id: string;
  n: number;
  html: string;
  title: string;
  summary: string;
  prompt: string;
  created_at: number;
}

export type VersionMeta = Omit<Version, "html">;

export type GenerateMode = "create" | "edit" | "fix" | "explain" | "plan";

/** 질문으로 시작하기: AI가 묻는 질문 하나 */
export interface PlanQuestion {
  id: string;
  question: string;
  type: "single" | "multi" | "text";
  options: string[];
  allowOther: boolean;
}

/** 질문으로 시작하기: 대화가 모이면 나오는 설계안 */
export interface PlanSpec {
  title: string;
  summary: string;
  features: string[];
  later: string[];
  prompt: string;
}

export interface PlanReply {
  message: string;
  questions: PlanQuestion[];
  plan: PlanSpec | null;
}

export interface PlanHistoryItem {
  role: "user" | "ai";
  text: string;
}

/** /api/generate 가 한 줄씩 내려보내는 이벤트 */
export type StreamEvent =
  | { t: "status"; d: string }
  | { t: "delta"; d: string }
  | { t: "warn"; d: string }
  | { t: "done"; version?: VersionMeta; answer?: string; plan?: PlanReply; summary: string; remaining: number }
  | { t: "refused"; d: string; remaining: number }
  | { t: "error"; d: string };

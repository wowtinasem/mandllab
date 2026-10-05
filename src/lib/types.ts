export type SessionStatus = "active" | "ended" | "expired";

export interface Instructor {
  id: string;
  email: string;
  name: string;
  org: string;
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

export type GenerateMode = "create" | "edit" | "fix" | "explain";

/** /api/generate 가 한 줄씩 내려보내는 이벤트 */
export type StreamEvent =
  | { t: "status"; d: string }
  | { t: "delta"; d: string }
  | { t: "warn"; d: string }
  | { t: "done"; version?: VersionMeta; answer?: string; summary: string; remaining: number }
  | { t: "refused"; d: string; remaining: number }
  | { t: "error"; d: string };

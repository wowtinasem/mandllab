import "server-only";

/** 강사 화면은 15초마다 메모를 확인한다. 마지막 확인이 이 시간 안이면 "접속 중"으로 본다 */
export const ONLINE_WINDOW_MS = 60_000;

export type MessageTarget = "one" | "online" | "teaching" | "all";

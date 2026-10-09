// 전화번호는 010-0000-0000 한 가지 모양만 쓴다.
// 화면에서는 입력하는 대로 이 모양으로 맞춰 보여 주고, 저장할 때는 숫자 11자리(01012345678)로 둔다.

/** 숫자만 꺼내고 +82 / 82 로 시작하면 0 으로 바꾼다 */
function digitsOf(input: string): string {
  let d = String(input ?? "").replace(/\D/g, "");
  if (d.startsWith("82")) d = `0${d.slice(2)}`;
  if (d.startsWith("00")) d = d.slice(1); // "+82 010…" 처럼 0 이 겹친 경우
  return d;
}

/** 입력 중인 값을 010-0000-0000 모양으로 맞춘다 (최대 11자리) */
export function formatPhoneInput(input: string): string {
  const d = digitsOf(input).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/** 저장용: 010 으로 시작하는 11자리면 "01012345678", 아니면 빈 문자열 */
export function normalizePhone(input: string): string {
  const d = digitsOf(input);
  return /^010\d{8}$/.test(d) ? d : "";
}

/** 표시용: "01012345678" → "010-1234-5678" */
export function formatPhone(digits: string): string {
  return formatPhoneInput(digits);
}

export const PHONE_HINT = "010-0000-0000 형식의 휴대폰 번호를 입력해 주세요.";

/** 이름 비교용: 앞뒤·중간 띄어쓰기를 무시한다 ("김 민수" = "김민수") */
export function normalizeName(input: string): string {
  return String(input ?? "").replace(/\s+/g, "").trim();
}

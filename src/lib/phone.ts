/** "010-1234-5678", "010 1234 5678" → "01012345678". 형식이 아니면 빈 문자열 */
export function normalizePhone(input: string): string {
  const digits = String(input ?? "").replace(/\D/g, "");
  const local = digits.startsWith("82") ? `0${digits.slice(2)}` : digits; // +82 10-… 도 받아 준다
  return /^0\d{8,10}$/.test(local) ? local : "";
}

/** "01012345678" → "010-1234-5678" */
export function formatPhone(digits: string): string {
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10)
    return digits.startsWith("02")
      ? `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
      : `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}

/** 이름 비교용: 앞뒤·중간 띄어쓰기를 무시한다 ("김 민수" = "김민수") */
export function normalizeName(input: string): string {
  return String(input ?? "").replace(/\s+/g, "").trim();
}

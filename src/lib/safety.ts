import "server-only";

// 기본 안전 필터: 악성코드·피싱·불법 목적만 막고, 개인정보는 경고만 한다.
const BLOCK_RULES: { re: RegExp; reason: string }[] = [
  { re: /피싱|phishing/i, reason: "피싱 페이지는 만들 수 없어요." },
  {
    re: /(네이버|카카오|구글|google|은행|bank|애플|apple|인스타|instagram|페이스북|facebook).{0,12}(로그인|login).{0,12}(똑같이|그대로|복제|클론|clone|가짜)/i,
    reason: "실제 서비스의 로그인 화면을 흉내 낸 페이지는 만들 수 없어요.",
  },
  { re: /(비밀번호|패스워드|password|계정).{0,10}(탈취|훔치|빼내|수집해서\s*전송)/i, reason: "다른 사람의 계정 정보를 빼내는 기능은 만들 수 없어요." },
  { re: /키로거|keylogger|랜섬웨어|ransomware|악성\s*코드|malware|트로이|백도어|backdoor/i, reason: "악성코드는 만들 수 없어요." },
  { re: /디도스|ddos|dos\s*공격|무한\s*요청.{0,6}공격/i, reason: "다른 서비스를 공격하는 기능은 만들 수 없어요." },
  { re: /(카드\s*번호|주민\s*(등록)?\s*번호).{0,12}(몰래|수집해서|빼내|전송)/i, reason: "개인정보를 몰래 수집하는 기능은 만들 수 없어요." },
  { re: /도박\s*사이트|불법\s*(촬영|도박|복제)|마약/i, reason: "불법 목적의 앱은 만들 수 없어요." },
];

const WARN_RULES: { re: RegExp; reason: string }[] = [
  { re: /\d{6}\s*-\s*[1-4]\d{6}/, reason: "주민등록번호처럼 보이는 내용이 있어요. 실제 개인정보는 넣지 마세요." },
  { re: /01[016789]-?\d{3,4}-?\d{4}/, reason: "전화번호처럼 보이는 내용이 있어요. 실제 개인정보는 넣지 않는 걸 권해요." },
  { re: /(api[_\s-]?key|secret|비밀\s*키|access[_\s-]?token)/i, reason: "API 키나 비밀번호는 앱 코드에 넣지 마세요. 다운로드한 파일에서 누구나 볼 수 있어요." },
];

export function checkPrompt(text: string): { blocked?: string; warnings: string[] } {
  for (const r of BLOCK_RULES) if (r.re.test(text)) return { blocked: r.reason, warnings: [] };
  return { warnings: WARN_RULES.filter((r) => r.re.test(text)).map((r) => r.reason) };
}

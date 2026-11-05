import Logo from "@/components/Logo";

export const metadata = { title: "이용약관과 개인정보 안내 — 만들랩" };

export default function Terms() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Logo />
      <h1 className="mt-8 text-2xl font-bold">이용약관과 개인정보 안내</h1>
      <p className="mt-2 text-sm text-muted">수업 운영자가 실제 약관으로 바꿔 써야 하는 기본 안내문입니다.</p>

      <section className="mt-8 space-y-6 text-[15px] leading-relaxed">
        <div>
          <h2 className="mb-2 font-bold">1. 이용 대상</h2>
          <p>만들랩은 만 18세 이상만 이용할 수 있습니다. 입장할 때 만 18세 이상임을 확인합니다.</p>
        </div>
        <div>
          <h2 className="mb-2 font-bold">2. 저장하는 정보</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>입장할 때 입력한 이름 또는 별명, 연령 확인·약관 동의 시각</li>
            <li>AI에게 보낸 요청 문장과 만들어진 앱 코드(버전 기록), 사용량 기록</li>
            <li>앱 안에서 올린 파일(CSV·엑셀·이미지)은 내 브라우저 안에서만 처리되며 서버로 보내지 않습니다. 단, 요청 문장에 직접 붙여 넣은 내용은 AI로 전송됩니다.</li>
          </ul>
        </div>
        <div>
          <h2 className="mb-2 font-bold">3. 보관 기간</h2>
          <p>
            결과물과 요청 기록은 수업이 끝난 뒤에도 보관되며, 수업을 운영한 기관(메인 관리자)이 삭제할 때 영구 삭제됩니다. 수업이 끝나고 30일이 지나면 메인 관리자에게 삭제 여부를 묻습니다. 비용 정산을 위한 사용량 합계(토큰 수, 비용)는 참여자 이름 없이 남습니다.
          </p>
        </div>
        <div>
          <h2 className="mb-2 font-bold">4. AI 처리</h2>
          <p>
            요청은 Google Gemini API(유료 등급)로 처리됩니다. 유료 등급에서는 입력 내용이 Google 제품 개선에 쓰이지 않습니다. 주민등록번호, 고객 명단 같은 실제 개인정보나 회사 기밀은 요청에 넣지 마세요.
          </p>
        </div>
        <div>
          <h2 className="mb-2 font-bold">5. 금지 행위</h2>
          <p>악성코드, 피싱 페이지, 실제 서비스를 흉내 낸 로그인 화면, 불법 목적의 앱은 만들 수 없으며 요청이 차단됩니다.</p>
        </div>
        <div>
          <h2 className="mb-2 font-bold">6. 결과물</h2>
          <p>만든 앱의 권리는 만든 사람에게 있습니다. 내려받은 파일 첫머리에는 만들랩으로 만들었다는 표시가 들어갑니다.</p>
        </div>
      </section>
    </main>
  );
}

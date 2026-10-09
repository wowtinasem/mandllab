"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { api } from "@/lib/client";
import type { Instructor } from "@/lib/types";

const SECTIONS = [
  ["prepare", "1. 수업 전 준비"],
  ["create", "2. 수업 만들기"],
  ["timeline", "3. 수업 당일 진행 순서"],
  ["join", "4. 학생 입장시키기"],
  ["student", "5. 학생 화면 기능"],
  ["dashboard", "6. 강사 대시보드 쓰는 법"],
  ["present", "7. 발표 화면과 결과 공유"],
  ["finish", "8. 수업 마무리"],
  ["prompt", "9. 좋은 요청 쓰는 법 (학생 안내용)"],
  ["trouble", "10. 자주 생기는 상황과 해결"],
  ["safety", "11. 안전·개인정보 수칙"],
] as const;

/** 강사용 사용 가이드. 강사(또는 메인 관리자)로 로그인했을 때만 보인다 */
export default function TeacherGuide() {
  const [me, setMe] = useState<Instructor | null | undefined>(undefined);

  useEffect(() => {
    api<{ instructor: Instructor | null }>("/api/instructor/me")
      .then((r) => setMe(r.instructor))
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) return <div className="grid min-h-screen place-items-center text-muted">불러오는 중…</div>;
  if (!me)
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <p className="text-lg font-bold">강사 사용 가이드는 로그인한 강사만 볼 수 있어요.</p>
          <Link href="/teacher" className="btn-primary mt-4">
            강사 로그인
          </Link>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Logo href="/teacher" />
          <span className="flex-1 text-sm font-semibold text-muted">강사 사용 가이드</span>
          <button className="btn-ghost py-1.5" onClick={() => window.print()}>
            🖨 인쇄
          </button>
          <Link href="/teacher" className="btn-primary py-1.5">
            ← 수업 목록
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 lg:grid-cols-[220px_1fr]">
        <nav className="h-fit lg:sticky lg:top-20 print:hidden" aria-label="가이드 목차">
          <div className="mb-2 text-xs font-bold text-muted">목차</div>
          <ol className="space-y-1 text-sm">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-lg px-2 py-1 text-muted hover:bg-surface-2 hover:text-ink">
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="guide min-w-0 space-y-12 text-[15px] leading-relaxed">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">만들랩 강사 사용 가이드</h1>
            <p className="mt-2 text-muted">
              학생들이 말로 설명해서 실제로 쓰는 웹 앱을 만들고, HTML 파일로 가져가는 수업을 진행하는 방법이에요. 처음이라면 1번부터 차례로 읽고,
              수업 중에는 6번과 10번을 옆에 띄워 두세요.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Summary icon="🧑‍🏫" title="강사" text="수업을 만들고 코드를 받아 학생에게 알려 줘요" />
              <Summary icon="🎒" title="학생" text="로그인 없이 강의 코드와 별명으로 바로 입장해요" />
              <Summary icon="📦" title="결과물" text="학생이 만든 앱은 HTML 파일 하나로 내려받아요" />
            </div>
          </div>

          <Section id="prepare" title="1. 수업 전 준비">
            <Steps
              items={[
                <>
                  <b>강사 로그인 확인:</b> 강사 화면(<code>/teacher</code>)에서 등록된 <b>이름 + 전화번호</b>로 로그인돼야 해요. 로그인이 안 되면 메인
                  관리자에게 명단 등록을 요청하세요.
                </>,
                <>
                  <b>강의실 인터넷:</b> 학생들이 각자 노트북·휴대폰으로 접속해요. 회사·학교 방화벽이 있다면 <code>mandllab.vercel.app</code>과
                  차트 같은 라이브러리를 불러오는 <code>cdn.jsdelivr.net</code>, <code>cdnjs.cloudflare.com</code>, <code>unpkg.com</code>이 열려 있는지
                  미리 확인하세요.
                </>,
                <>
                  <b>학생 기기:</b> 최신 크롬·엣지·사파리를 권장해요. 노트북이 가장 편하고, 휴대폰도 됩니다(화면 위 <b>대화 / 내 앱</b> 탭으로 전환).
                </>,
                <>
                  <b>프로젝터:</b> 강사 노트북을 프로젝터에 연결해 두세요. 수업 중에 <b>📺 발표 화면</b>을 새 창으로 띄워 코드를 크게 보여 줄 거예요.
                </>,
                <>
                  <b>리허설:</b> 처음이라면 수업 전날 테스트 수업을 하나 만들어, 다른 브라우저(시크릿 창 <kbd>Ctrl+Shift+N</kbd>)에서 학생으로 들어가
                  앱을 하나 만들어 보세요. 10분이면 충분해요.
                </>,
              ]}
            />
            <Tip>학생 대상은 만 18세 이상이에요. 입장할 때 학생이 직접 연령 확인과 약관 동의에 체크해요.</Tip>
          </Section>

          <Section id="create" title="2. 수업 만들기">
            <p>
              강사 화면의 <b>새 수업 만들기</b>에서 아래 칸을 채우고 <b>수업 만들고 코드 받기</b>를 누르면 6자리 강의 코드가 나와요.
            </p>
            <Table
              head={["칸", "뜻", "다 차면", "권장값"]}
              rows={[
                ["수업 이름", "학생 화면·발표 화면·보고서에 보여요", "-", "예: 영업팀 업무 자동화 워크숍"],
                ["1인 요청 한도", "학생 한 명이 AI에게 만들기·고치기·질문을 보낼 수 있는 횟수", "그 학생만 AI 요청이 막혀요 (코드 직접 수정은 가능)", "2시간 수업 25~30회"],
                ["정원", "코드로 들어올 수 있는 최대 인원", "새 입장이 막혀요", "예상 인원 + 10%"],
                ["비용 상한 (USD)", "이 수업 전체의 AI 사용료 한도", "수업 전원의 AI 요청이 멈춰요", "아래 계산 참고"],
                ["진행 시간 (분)", "만든 순간부터 이 시간이 지나면 자동 종료", "더 만들 수 없고 다운로드만 가능", "수업 시간 + 30~60분 (0이면 자동 종료 없음)"],
              ]}
            />
            <h3 className="pt-2 text-base font-bold">비용 상한 정하기</h3>
            <p>
              실제 측정해 보면 AI 요청 1회에 <b>약 8~10원</b>이 들어요(처음 만들기는 조금 더, 고치기는 더 적게). 40명이 30회씩 모두 써도 약 1만 원
              안팎이에요.
            </p>
            <Table
              head={["수업 규모", "권장 비용 상한"]}
              rows={[
                ["20명 × 25회", "$10 (약 1만 4천 원)"],
                ["40명 × 30회", "$15~20 (약 2~3만 원)"],
                ["60명 × 30회", "$25~30"],
              ]}
            />
            <Tip>
              비용 상한은 미리 내는 돈이 아니라 &ldquo;여기까지만 쓰겠다&rdquo;는 안전선이에요. 수업 중에도 대시보드의 <b>⚙ 한도 설정</b>에서 언제든 올릴 수
              있어요.
            </Tip>
          </Section>

          <Section id="timeline" title="3. 수업 당일 진행 순서 (2시간 예시)">
            <Table
              head={["시간", "할 일", "강사 화면에서"]}
              rows={[
                ["수업 전", "수업 만들기, 발표 화면 띄우기", "새 수업 만들기 → 📺 발표 화면"],
                ["0~5분", "학생 입장", "발표 화면의 주소·코드 안내, 진행 현황에서 입장 인원 확인"],
                ["5~30분", "첫 앱 만들기", "미션 방송: “시작 카드를 하나 골라 첫 앱을 만들어 보세요”"],
                ["30~60분", "고치기 연습", "미션: “색과 글자 크기를 내 취향대로”, 🆘 표시 학생 돕기"],
                ["60~100분", "내 업무·과제용 앱으로 확장", "미션: “표나 차트를 하나 넣어 보세요”, 좋은 사례 📺 띄우기"],
                ["100~115분", "갤러리 공유와 발표", "미션: “완성한 앱을 갤러리에 올려 보세요”, 발표 화면에 하나씩 띄우기"],
                ["115~120분", "다운로드와 마무리", "학생에게 HTML 다운로드 안내 → ■ 수업 종료 → 사용량 보고서 받기"],
              ]}
            />
            <Tip>설명할 때는 <b>✋ 전체 일시정지</b>를 누르면 학생 화면이 잠기고 &ldquo;잠시 화면을 봐 주세요&rdquo;가 떠요.</Tip>
          </Section>

          <Section id="join" title="4. 학생 입장시키기">
            <Steps
              items={[
                <>
                  수업 대시보드 위쪽의 <b>📺 발표 화면</b>을 눌러 새 창을 프로젝터에 띄워요. 사이트 주소와 강의 코드가 크게 보여요.
                </>,
                <>
                  학생은 <b>mandllab.vercel.app</b>에 들어가 <b>강의 코드 6자리 → 이름 또는 별명 → 만 18세·약관 동의</b> 순서로 입장해요. 소문자로 쳐도
                  돼요.
                </>,
                <>
                  입장하면 학생마다 <b>복귀 코드</b>(예: <code>ABCD-EFGH</code>)가 나와요. <b>꼭 적어 두라고</b> 안내해 주세요. 다른 컴퓨터에서 이어
                  하거나 수업 뒤 다운로드할 때 필요해요.
                </>,
                <>같은 별명이 있으면 자동으로 &ldquo;민수(2)&rdquo;처럼 구분돼요.</>,
                <>
                  인원이 다 들어오면 <b>🔒 입장 잠금</b>으로 외부 사람이 들어오지 못하게 할 수 있어요. 늦게 온 학생이 있으면 잠시 풀어 주세요.
                </>,
              ]}
            />
            <Tip>
              학생이 브라우저를 닫았다가 다시 열면 같은 기기에서는 <b>이어서 만들기</b> 버튼이 바로 보여요. 다른 기기라면 첫 화면의 <b>다른 기기에서 하던
              작업 이어 하기</b>에 강의 코드와 복귀 코드를 넣으면 돼요.
            </Tip>
          </Section>

          <Section id="student" title="5. 학생 화면 기능">
            <Table
              head={["기능", "설명"]}
              rows={[
                ["시작 카드 6종", "견적 계산기, 데이터 정리기, 일정 대시보드, 설문·투표, 퀴즈, 할 일 체크리스트. 누르면 요청 문장이 채워져요"],
                ["💡 질문으로 시작하기", "아이디어만 있을 때 AI가 보기 있는 질문을 하고, 고르면 설계안을 만들어 줘요. “🚀 이대로 만들기”로 바로 제작"],
                ["⚡ 바로 만들기 / 고치기", "만들고 싶은 것이나 바꿀 것을 말로 적고 Enter. 보낸 요청은 대화 목록에 남아요"],
                ["힌트 버튼", "“휴대폰에서도 보기 좋게”, “결과를 차트로” 같은 자주 쓰는 수정 요청"],
                ["미리보기", "만든 앱을 바로 써 볼 수 있어요. 오류가 나면 빨간 줄과 함께 “AI로 고치기” 버튼이 떠요"],
                ["코드", "코드와 결과를 나란히 보고 직접 고칠 수 있어요(요청 횟수 안 씀). “설명 듣기”로 코드에 대해 질문"],
                ["◀ v3/5 ▶", "버전 이동. 이전 버전을 보다가 요청하면 그 버전을 바탕으로 고쳐요"],
                ["갤러리", "다른 학생의 앱을 열어 보고 🔁 리믹스해서 내 앱으로 이어 만들 수 있어요"],
                ["⬇ 다운로드", "원하는 버전을 HTML 파일 하나로 내려받아요. 더블클릭하면 어디서나 열려요"],
                ["화면 테마", "☀️ 라이트 · 🌙 다크 · 🌿 그린 중 선택"],
                ["창 크기 조절", "대화 창과 결과 창 사이 경계선을 끌어 넓이를 바꿔요(더블클릭하면 원래대로)"],
              ]}
            />
            <Tip>오른쪽 위 &ldquo;남은 요청 27/30&rdquo;에서 학생이 남은 횟수를 직접 볼 수 있어요.</Tip>
          </Section>

          <Section id="dashboard" title="6. 강사 대시보드 쓰는 법">
            <p>수업 목록에서 수업을 누르면 대시보드가 열려요. 3초마다 자동으로 새로 고쳐져요.</p>
            <Table
              head={["화면·버튼", "언제 쓰나요"]}
              rows={[
                ["진행 현황표", "학생별 요청 수, 버전 수, 마지막 활동, 만든 앱 제목. 맨 위에 🆘 학생이 먼저 보여요"],
                ["🆘 도움이 필요해 보임", "5분 넘게 활동이 없거나 연속으로 실패한 학생. 먼저 가서 도와주세요"],
                ["보기", "그 학생의 최신 앱을 크게 열어 봐요"],
                ["📺 띄우기", "그 학생 앱을 발표 화면에 전체 화면으로 보여줘요"],
                ["+5회", "요청을 다 쓴 학생에게 5회를 더 줘요"],
                ["🎯 미션 방송", "모든 학생 화면 위쪽에 과제를 띄워요. 자주 쓰는 미션은 버튼으로 한 번에"],
                ["✋ 전체 일시정지", "설명할 때 학생 입력을 잠가요. 다시 누르면 풀려요"],
                ["🔒 입장 잠금", "새 학생이 못 들어오게 해요. 이미 들어온 학생은 그대로"],
                ["+30분 연장", "자동 종료 시각을 30분 늦춰요"],
                ["⚙ 한도 설정", "1인 요청 한도, 비용 상한, 정원을 수업 중에 바꿔요"],
                ["AI 비용", "지금까지 쓴 금액과 상한 대비 막대. 빨갛게 되면 상한을 올리세요"],
                ["갤러리 / 활동 기록", "학생이 올린 앱, 생성·수정·차단 등 모든 활동"],
              ]}
            />
          </Section>

          <Section id="present" title="7. 발표 화면과 결과 공유">
            <Steps
              items={[
                <>
                  <b>📺 발표 화면</b>은 평소에는 주소·강의 코드·미션·입장 인원·앱 완성 인원을 크게 보여 줘요.
                </>,
                <>
                  대시보드에서 학생 줄의 <b>📺 띄우기</b>나 갤러리의 <b>📺</b>를 누르면 발표 화면이 그 학생 앱으로 바뀌어요. 학생이 직접 앞에 나오지
                  않아도 시연할 수 있어요.
                </>,
                <>
                  다시 코드 화면으로 돌아가려면 갤러리 위의 <b>발표 화면 비우기</b>를 누르세요.
                </>,
                <>학생에게 &ldquo;갤러리에 올리기&rdquo;를 하게 하면 서로의 앱을 보고 리믹스하며 배울 수 있어요.</>,
              ]}
            />
          </Section>

          <Section id="finish" title="8. 수업 마무리">
            <Steps
              items={[
                <>
                  학생에게 <b>⬇ 다운로드</b>로 HTML 파일을 받게 안내해요. 차트처럼 외부 라이브러리를 쓰는 앱은 열 때 인터넷이 필요하다는 것도 알려
                  주세요.
                </>,
                <>
                  <b>🗂 갤러리 ZIP</b>으로 학생들이 올린 앱을 한 번에 내려받아 보관할 수 있어요.
                </>,
                <>
                  <b>📄 사용량 보고서</b>(CSV, 엑셀로 열림)로 학생별 AI 호출 수와 비용을 확인해요. 고객사 정산에 그대로 쓸 수 있어요.
                </>,
                <>
                  <b>■ 수업 종료</b>를 누르면 학생은 더 만들 수 없고 다운로드만 할 수 있어요. 필요하면 <b>▶ 수업 재개</b>로 다시 열 수 있어요.
                </>,
                <>
                  종료 <b>7일 뒤</b> 학생 결과물과 기록이 자동으로 영구 삭제돼요(사용량 합계만 남음). 바로 지우려면 <b>🗑 삭제</b>를 누르세요. 삭제는
                  되돌릴 수 없고, 같은 강의 코드는 다시 쓰이지 않아요.
                </>,
              ]}
            />
          </Section>

          <Section id="prompt" title="9. 좋은 요청 쓰는 법 (학생 안내용)">
            <p>수업 시작 때 화면에 띄워 함께 읽으면 좋아요.</p>
            <Table
              head={["이렇게 쓰면 좋아요", "예시"]}
              rows={[
                ["누가·무엇을 하는 앱인지", "“영업팀이 고객별 견적을 계산하는 앱을 만들어줘”"],
                ["입력과 결과를 구체적으로", "“품목·단가·수량을 넣으면 공급가와 부가세 10%, 총액을 보여줘”"],
                ["한 번에 하나씩 고치기", "“합계 아래에 막대 차트를 넣어줘” → 확인 → 다음 요청"],
                ["보이는 그대로 말하기", "“오른쪽 위 저장 버튼이 너무 작아, 두 배로 키워줘”"],
                ["저장이 필요하면 말하기", "“새로고침해도 입력한 내용이 남게 해줘”"],
                ["모르면 물어보기", "아이디어가 막히면 💬 질문하며 정하기, 코드가 궁금하면 코드 탭의 설명 듣기"],
              ]}
            />
            <Tip>막히면 &ldquo;이전 버전(◀)으로 돌아가서 다시 요청하기&rdquo;가 가장 빠른 해결책이에요.</Tip>
          </Section>

          <Section id="trouble" title="10. 자주 생기는 상황과 해결">
            <Table
              head={["상황", "해결"]}
              rows={[
                ["“강의 코드를 다시 확인해 주세요”", "코드 6자리를 다시 확인. 삭제된 수업이거나 다른 수업 코드일 수 있어요"],
                ["“이미 끝난 수업이에요”", "수업이 종료됨. 대시보드에서 ▶ 수업 재개, 또는 +30분 연장"],
                ["“정원이 다 찼어요”", "⚙ 한도 설정에서 정원을 늘려요"],
                ["“강사가 입장을 잠가 두었어요”", "🔓 입장 잠금 해제"],
                ["학생 요청 횟수를 다 씀", "학생 줄의 +5회. 학생은 코드 탭에서 직접 고치기도 가능"],
                ["“이번 수업의 AI 사용 한도에 도달”", "⚙ 한도 설정에서 비용 상한을 올려요"],
                ["“AI가 잠시 쉬고 있어요”", "요청이 몰린 상태. 30초 뒤 다시 보내면 돼요(횟수는 차감되지 않음)"],
                ["앱에 오류가 남", "미리보기 위 빨간 줄의 “AI로 고치기”, 또는 ◀ 이전 버전으로"],
                ["요청이 거절됨", "피싱·악성코드·실제 서비스 로그인 화면 흉내 같은 요청은 안전 필터가 막아요"],
                ["학생이 다른 컴퓨터로 옮김", "첫 화면 “다른 기기에서 하던 작업 이어 하기”에 강의 코드 + 복귀 코드"],
                ["복귀 코드를 잃어버림", "같은 브라우저라면 첫 화면의 이어서 만들기로 들어갈 수 있어요. 아니면 새 별명으로 입장 후 갤러리에서 리믹스"],
                ["강사 로그인이 안 됨", "등록된 이름과 전화번호(010-0000-0000)가 맞는지 확인, 안 되면 메인 관리자에게 문의"],
              ]}
            />
          </Section>

          <Section id="safety" title="11. 안전·개인정보 수칙">
            <Steps
              items={[
                <>학생에게 주민등록번호, 실제 고객 명단, 회사 기밀을 요청 문장에 넣지 말라고 안내해 주세요. 전화번호 같은 정보를 넣으면 화면에 경고가 떠요.</>,
                <>앱 안에서 올리는 CSV·엑셀 파일은 학생 브라우저 안에서만 읽고 서버로 보내지 않아요.</>,
                <>API 키나 비밀번호가 필요한 서비스는 코드에 넣지 않도록 해요. 내려받은 파일은 누구나 열어 볼 수 있어요.</>,
                <>저장되는 정보는 별명, 요청 문장, 만든 앱 코드, 사용량이에요. 수업 종료 7일 뒤 자동 삭제돼요.</>,
                <>학생은 만 18세 이상만 참여할 수 있어요.</>,
              ]}
            />
          </Section>

          <p className="border-t border-line pt-6 text-center text-xs text-muted">Copyright © (주)드림정보</p>
        </article>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <h2 className="border-b border-line pb-2 text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{i + 1}</span>
          <div className="min-w-0">{it}</div>
        </li>
      ))}
    </ol>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-left text-xs text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line align-top">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2 ${j === 0 ? "whitespace-nowrap font-semibold" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm">💡 {children}</p>;
}

function Summary({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="card p-4">
      <div className="text-2xl">{icon}</div>
      <div className="mt-1 font-bold">{title}</div>
      <div className="text-sm text-muted">{text}</div>
    </div>
  );
}

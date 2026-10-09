"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import MessagePopup from "@/components/MessagePopup";
import AskAdminButton from "@/components/AskAdminButton";
import { api } from "@/lib/client";
import type { Instructor } from "@/lib/types";

const TOC_KEY = "ml:guideToc";

const SECTIONS = [
  ["prepare", "1. 수업 전 준비"],
  ["create", "2. 수업 만들기"],
  ["timeline", "3. 수업 당일 진행 순서 (예시)"],
  ["join", "4. 학생 입장시키기"],
  ["student", "5. 학생 화면 기능"],
  ["dashboard", "6. 강사 대시보드 사용법"],
  ["present", "7. 발표 화면과 결과 공유"],
  ["finish", "8. 수업 마무리"],
  ["prompt", "9. 좋은 요청 작성법 (학생 안내용)"],
  ["trouble", "10. 자주 생기는 상황과 해결"],
  ["safety", "11. 안전·개인정보 수칙"],
] as const;

/** 강사용 사용 가이드. 강사(또는 메인 관리자)로 로그인했을 때만 보인다. 큰 글씨, 합니다체 */
export default function TeacherGuide() {
  const [me, setMe] = useState<Instructor | null | undefined>(undefined);
  // 왼쪽 목차: 열고 닫은 상태는 이 브라우저에 기억한다. 처음에는 넓은 화면에서만 열어 둔다
  const [tocOpen, setTocOpen] = useState(false);
  const [active, setActive] = useState<string>(SECTIONS[0][0]);

  useEffect(() => {
    api<{ instructor: Instructor | null }>("/api/instructor/me")
      .then((r) => setMe(r.instructor))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    let open = window.matchMedia("(min-width: 1024px)").matches;
    try {
      const saved = localStorage.getItem(TOC_KEY);
      if (saved === "open" || saved === "closed") open = saved === "open";
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 화면 너비와 저장값은 브라우저에서만 알 수 있다
    setTocOpen(open);
  }, []);

  // 지금 읽고 있는 장을 목차에 표시
  useEffect(() => {
    if (!me) return;
    const els = SECTIONS.map(([id]) => document.getElementById(id)).filter((e): e is HTMLElement => Boolean(e));
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-90px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [me]);

  const toggleToc = (open: boolean) => {
    setTocOpen(open);
    try {
      localStorage.setItem(TOC_KEY, open ? "open" : "closed");
    } catch {}
  };

  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
    // 좁은 화면에서는 목차가 본문을 가리므로 고르면 닫는다
    if (!window.matchMedia("(min-width: 1024px)").matches) setTocOpen(false);
  };

  if (me === undefined) return <div className="grid min-h-screen place-items-center text-muted">불러오는 중…</div>;
  if (!me)
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <p className="text-2xl font-bold">강사 사용 가이드는 로그인한 강사만 볼 수 있습니다.</p>
          <Link href="/teacher" className="btn-primary mt-6 px-6 py-3 text-lg">
            강사 로그인
          </Link>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen">
      <MessagePopup />
      <header className="sticky top-0 z-30 h-[65px] border-b border-line bg-surface/95 backdrop-blur print:hidden">
        <div className="flex h-full items-center gap-3 px-4">
          <button
            className={`${tocOpen ? "btn-primary" : "btn-ghost"} shrink-0 whitespace-nowrap py-2 text-base`}
            onClick={() => toggleToc(!tocOpen)}
            aria-expanded={tocOpen}
            aria-controls="guide-toc"
          >
            ☰ 목차<span className="hidden sm:inline"> {tocOpen ? "닫기" : "열기"}</span>
          </button>
          <Logo href="/teacher" />
          <span className="flex-1 truncate text-base font-semibold text-muted">
            <span className="hidden sm:inline">강사 사용 가이드</span>
          </span>
          <AskAdminButton className="btn-ghost shrink-0 whitespace-nowrap py-2 text-base" />
          <button className="btn-ghost hidden py-2 text-base sm:inline-flex" onClick={() => window.print()}>
            🖨 인쇄
          </button>
          <Link href="/teacher" className="btn-primary shrink-0 whitespace-nowrap py-2 text-base">
            ← <span className="hidden sm:inline">수업 </span>목록
          </Link>
        </div>
      </header>

      {/* 왼쪽 목차 서랍 */}
      {tocOpen && (
        <div className="fixed inset-0 top-[65px] z-10 bg-black/30 lg:hidden print:hidden" onClick={() => toggleToc(false)} aria-hidden />
      )}
      <aside
        id="guide-toc"
        aria-label="가이드 목차"
        className={`fixed top-[65px] bottom-0 left-0 z-20 w-[360px] max-w-[85vw] overflow-y-auto border-r border-line bg-surface p-5 shadow-lg transition-transform duration-200 lg:shadow-none print:hidden ${
          tocOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[24px] font-bold">목차</span>
          <button className="rounded-lg px-2 py-1 text-[22px] text-muted hover:bg-surface-2 hover:text-ink" onClick={() => toggleToc(false)} aria-label="목차 닫기">
            ✕
          </button>
        </div>
        <ol className="space-y-1">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <button
                onClick={() => goTo(id)}
                aria-current={active === id ? "true" : undefined}
                className={`block w-full rounded-xl px-3 py-2 text-left text-[22px] leading-snug transition ${
                  active === id ? "bg-accent-soft font-bold text-accent" : "text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {label}
              </button>
            </li>
          ))}
        </ol>
      </aside>

      {/* 목차를 닫아 두었을 때 왼쪽 가장자리의 여는 탭 */}
      {!tocOpen && (
        <button
          onClick={() => toggleToc(true)}
          className="fixed top-1/3 left-0 z-20 rounded-r-2xl border border-l-0 border-line bg-surface px-3 py-5 text-[20px] font-bold text-accent shadow-md hover:bg-accent-soft print:hidden [writing-mode:vertical-rl]"
          aria-label="목차 열기"
        >
          📑 목차
        </button>
      )}

      <div className={`transition-[padding] duration-200 ${tocOpen ? "lg:pl-[360px]" : ""}`}>
      <article className="guide mx-auto max-w-[1400px] space-y-20 px-4 py-12 text-[30px] leading-relaxed sm:px-8">
        <div>
          <h1 className="text-[60px] font-extrabold leading-tight tracking-tight">만들랩 강사 사용 가이드</h1>
          <p className="mt-4 text-muted">
            학생들이 말로 설명해서 실제로 쓰는 웹 앱을 만들고, HTML 파일로 가져가는 수업을 진행하는 방법을 안내합니다. 처음이시라면 1번부터 차례로
            읽어 주시고, 수업 중에는 6번과 10번을 옆에 띄워 두십시오.
          </p>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <Summary icon="🧑‍🏫" title="강사" text="수업을 만들고 코드를 받아 학생에게 알려 줍니다." />
            <Summary icon="🎒" title="학생" text="로그인 없이 강의 코드와 별명으로 바로 입장합니다." />
            <Summary icon="📦" title="결과물" text="학생이 만든 앱은 HTML 파일 하나로 내려받습니다." />
          </div>
        </div>


        <Section id="prepare" title="1. 수업 전 준비">
          <Steps
            items={[
              <>
                <b>강사 로그인 확인:</b> 강사 화면(<code>/teacher</code>)에서 등록된 <b>이름 + 전화번호</b>로 로그인되어야 합니다. 로그인이 되지 않으면
                메인 관리자에게 명단 등록을 요청하십시오.
              </>,
              <>
                <b>강의실 인터넷:</b> 학생들이 각자 노트북·휴대폰으로 접속합니다. 회사·학교 방화벽이 있다면 <code>mandllab.vercel.app</code>과 차트 같은
                라이브러리를 불러오는 <code>cdn.jsdelivr.net</code>, <code>cdnjs.cloudflare.com</code>, <code>unpkg.com</code>이 열려 있는지 미리
                확인하십시오.
              </>,
              <>
                <b>학생 기기:</b> 최신 크롬·엣지·사파리를 권장합니다. 노트북이 가장 편하며, 휴대폰도 사용할 수 있습니다(화면 위 <b>대화 / 내 앱</b> 탭으로
                전환).
              </>,
              <>
                <b>프로젝터:</b> 강사 노트북을 프로젝터에 연결해 두십시오. 수업 중에 <b>📺 발표 화면</b>을 새 창으로 띄워 코드를 크게 보여 줍니다.
              </>,
              <>
                <b>리허설:</b> 처음이시라면 수업 전날 테스트 수업을 하나 만들고, 다른 브라우저(시크릿 창 <kbd>Ctrl+Shift+N</kbd>)에서 학생으로 들어가 앱을
                하나 만들어 보십시오. 10분이면 충분합니다.
              </>,
            ]}
          />
          <Tip>학생 대상은 만 18세 이상입니다. 입장할 때 학생이 직접 연령 확인과 약관 동의에 체크합니다.</Tip>
        </Section>

        <Section id="create" title="2. 수업 만들기">
          <p>
            강사 화면의 <b>새 수업 만들기</b>에서 아래 칸을 채우고 <b>수업 만들고 코드 받기</b>를 누르면 6자리 강의 코드가 발급됩니다.
          </p>
          <Table
            head={["칸", "뜻", "다 차면", "권장값"]}
            rows={[
              ["수업 이름", "학생 화면·발표 화면·보고서에 표시됩니다", "-", "예: 영업팀 업무 자동화 워크숍"],
              ["1인 요청 한도", "학생 한 명이 AI에게 만들기·고치기·질문을 보낼 수 있는 횟수입니다", "그 학생만 AI 요청이 막힙니다 (코드 직접 수정은 가능)", "기본값 60회 (4시간 수업 기준)"],
              ["정원", "코드로 들어올 수 있는 최대 인원입니다", "새 입장이 막힙니다", "예상 인원 + 10%"],
              ["비용 상한 (USD)", "이 수업 전체의 AI 사용료 한도입니다", "수업 전원의 AI 요청이 멈춥니다", "아래 계산 참고"],
              ["진행 시간 (분)", "만든 순간부터 이 시간이 지나면 자동으로 종료됩니다. 수업은 최대 4시간(240분)입니다", "더 만들 수 없고 7일 동안 다운로드만 가능합니다", "기본값 240분. 수업에 맞게 줄여도 됩니다"],
            ]}
          />
          <h3 className="pt-4 text-[34px] font-bold">비용 상한 정하기</h3>
          <p>
            실제로 측정해 보면 AI 요청 1회에 <b>약 8~10원</b>이 듭니다(처음 만들기는 조금 더, 고치기는 더 적게). 4시간 수업에서 40명이 60회씩 모두
            사용해도 약 2만 원 안팎입니다.
          </p>
          <Table
            head={["수업 규모", "권장 비용 상한"]}
            rows={[
              ["20명 × 60회", "$15 (약 2만 원)"],
              ["40명 × 60회", "$25 (약 3만 5천 원, 기본값)"],
              ["60명 × 60회", "$35~40"],
            ]}
          />
          <Tip>
            비용 상한은 미리 내는 돈이 아니라 &ldquo;여기까지만 쓰겠다&rdquo;는 안전선입니다. 수업 중에도 대시보드의 <b>⚙ 한도 설정</b>에서 언제든
            올릴 수 있습니다.
          </Tip>
        </Section>

        <Section id="timeline" title="3. 수업 당일 진행 순서 (예시)">
          <p>
            수업은 <b>최대 4시간</b> 안에서 강사의 재량으로 자유롭게 진행하시면 됩니다. 아래는 시간표가 아니라 <b>권장하는 순서</b>이며, 순서를 바꾸거나
            건너뛰어도 됩니다.
          </p>
          <div className="flex flex-wrap gap-4 text-[26px]">
            <span className="flex items-center gap-2">
              <Badge kind="must" /> 수업을 원활하게 진행하기 위해 권장하는 단계
            </span>
            <span className="flex items-center gap-2">
              <Badge kind="option" /> 수업 상황에 따라 골라서 하는 단계
            </span>
          </div>
          <Tip>
            <b>필수</b>로 표시한 단계도 하지 않는다고 해서 학생의 앱 제작이 막히지는 않습니다. 학생은 강의 코드만 있으면 언제든 앱을 만들고 고치고
            내려받을 수 있습니다.
          </Tip>

          <Order
            items={[
              {
                kind: "start",
                title: "수업 만들기와 강의 코드 알리기",
                body: (
                  <>
                    새 수업을 만들어 강의 코드를 받고 학생에게 알려 줍니다. 학생이 들어오려면 강의 코드가 있어야 하므로 이 단계만은 꼭 필요합니다. 코드는
                    <b> 📺 발표 화면</b>, 칠판, 메신저 등 편한 방법으로 알리시면 됩니다.
                  </>
                ),
              },
              {
                kind: "must",
                title: "학생 입장 확인과 복귀 코드 안내",
                body: (
                  <>
                    진행 현황에서 입장 인원을 확인하고, 학생에게 <b>복귀 코드를 적어 두도록</b> 안내합니다. 안내하지 않아도 같은 기기에서는 계속 만들 수
                    있습니다.
                  </>
                ),
              },
              {
                kind: "must",
                title: "좋은 요청 작성법 함께 읽기",
                body: <>9번 &ldquo;좋은 요청 작성법&rdquo;을 화면에 띄워 함께 읽습니다. 처음 써 보는 학생이 덜 막힙니다.</>,
              },
              {
                kind: "must",
                title: "첫 앱 만들기",
                body: (
                  <>
                    시작 카드나 자유 설명으로 첫 앱을 만들게 합니다. 미션 방송 예: &ldquo;시작 카드를 하나 골라 첫 앱을 만들어 보세요&rdquo;
                  </>
                ),
              },
              {
                kind: "option",
                title: "고치기 연습",
                body: <>&ldquo;색과 글자 크기를 내 취향대로&rdquo;, &ldquo;휴대폰에서도 보기 좋게&rdquo; 같은 간단한 수정으로 말로 고치는 감각을 익힙니다.</>,
              },
              {
                kind: "option",
                title: "💬 질문으로 시작하기로 내 앱 기획",
                body: <>업무·과제에 쓸 앱 아이디어가 막연할 때, AI의 질문에 답하며 설계안을 만들고 &ldquo;🚀 이대로 만들기&rdquo;로 제작합니다.</>,
              },
              {
                kind: "must",
                title: "내 앱 만들기와 확장",
                body: <>표·차트, 저장, CSV 내려받기처럼 실제로 쓸 기능을 더해 갑니다. 🆘 표시가 뜬 학생을 먼저 도와주십시오.</>,
              },
              {
                kind: "option",
                title: "쉬는 시간",
                body: <>필요하면 ✋ 전체 일시정지로 잠시 멈춥니다. 일시정지를 쓰지 않아도 됩니다.</>,
              },
              {
                kind: "option",
                title: "갤러리 공유와 발표",
                body: <>학생이 앱을 갤러리에 올리고, 강사가 📺로 하나씩 발표 화면에 띄워 함께 봅니다. 다른 학생 앱을 🔁 리믹스해 볼 수도 있습니다.</>,
              },
              {
                kind: "must",
                title: "HTML 다운로드 안내",
                body: (
                  <>
                    학생에게 ⬇ 다운로드로 앱 파일을 받도록 안내합니다. 안내를 놓쳐도 학생은 수업 종료 뒤 <b>7일 동안</b> 복귀 코드로 다시 들어와
                    내려받을 수 있습니다.
                  </>
                ),
              },
              {
                kind: "option",
                title: "수업 종료와 기록 받기",
                body: (
                  <>
                    ■ 수업 종료를 누르고 📄 사용량 보고서와 🗂 갤러리 ZIP을 받습니다. 누르지 않아도 진행 시간이 지나면 <b>자동으로 종료</b>됩니다.
                  </>
                ),
              },
            ]}
          />
          <Tip>
            수업이 길어지면 대시보드의 <b>+30분 연장</b>으로 종료 시각을 늦출 수 있습니다. 수업을 만든 뒤 <b>최대 4시간</b>까지 연장됩니다.
          </Tip>
        </Section>

        <Section id="join" title="4. 학생 입장시키기">
          <Steps
            items={[
              <>
                수업 대시보드 위쪽의 <b>📺 발표 화면</b>을 눌러 새 창을 프로젝터에 띄웁니다. 사이트 주소와 강의 코드가 크게 표시됩니다.
              </>,
              <>
                학생은 <b>mandllab.vercel.app</b>에 들어가 <b>강의 코드 6자리 → 이름 또는 별명 → 만 18세·약관 동의</b> 순서로 입장합니다. 소문자로
                입력해도 됩니다.
              </>,
              <>
                입장하면 학생마다 <b>복귀 코드</b>(예: <code>ABCD-EFGH</code>)가 발급됩니다. <b>반드시 적어 두도록</b> 안내해 주십시오. 다른 컴퓨터에서 이어
                하거나 수업 뒤 다운로드할 때 필요합니다.
              </>,
              <>같은 별명이 있으면 자동으로 &ldquo;민수(2)&rdquo;처럼 구분됩니다.</>,
              <>
                인원이 모두 들어오면 <b>🔒 입장 잠금</b>으로 외부인이 들어오지 못하게 할 수 있습니다. 늦게 온 학생이 있으면 잠시 풀어 주십시오.
              </>,
            ]}
          />
          <Tip>
            학생이 브라우저를 닫았다가 다시 열면 같은 기기에서는 <b>이어서 만들기</b> 버튼이 바로 보입니다. 다른 기기라면 첫 화면의 <b>다른 기기에서 하던
            작업 이어 하기</b>에 강의 코드와 복귀 코드를 입력하면 됩니다.
          </Tip>
        </Section>

        <Section id="student" title="5. 학생 화면 기능">
          <Table
            head={["기능", "설명"]}
            rows={[
              ["시작 카드 6종", "견적 계산기, 데이터 정리기, 일정 대시보드, 설문·투표, 퀴즈, 할 일 체크리스트입니다. 누르면 요청 문장이 채워집니다"],
              ["💡 질문으로 시작하기", "아이디어만 있을 때 AI가 보기 있는 질문을 하고, 고르면 설계안을 만들어 줍니다. “🚀 이대로 만들기”로 바로 제작합니다"],
              ["⚡ 바로 만들기 / 고치기", "만들고 싶은 것이나 바꿀 것을 말로 적고 Enter를 누릅니다. 보낸 요청은 대화 목록에 남습니다"],
              ["힌트 버튼", "“휴대폰에서도 보기 좋게”, “결과를 차트로” 같은 자주 쓰는 수정 요청입니다"],
              ["미리보기", "만든 앱을 바로 사용해 볼 수 있습니다. 오류가 나면 빨간 줄과 함께 “AI로 고치기” 버튼이 나타납니다"],
              ["코드", "코드와 결과를 나란히 보며 직접 고칠 수 있습니다(요청 횟수 차감 없음). “설명 듣기”로 코드에 대해 질문합니다"],
              ["◀ v3/5 ▶", "버전을 이동합니다. 이전 버전을 보다가 요청하면 그 버전을 바탕으로 고칩니다"],
              ["갤러리", "다른 학생의 앱을 열어 보고 🔁 리믹스해서 내 앱으로 이어 만들 수 있습니다"],
              ["⬇ 다운로드", "원하는 버전을 HTML 파일 하나로 내려받습니다. 더블클릭하면 어디서나 열립니다"],
              ["화면 테마", "☀️ 라이트 · 🌙 다크 · 🌿 그린 중에서 고릅니다"],
              ["창 크기 조절", "대화 창과 결과 창 사이 경계선을 끌어 넓이를 바꿉니다(더블클릭하면 원래대로 돌아갑니다)"],
            ]}
          />
          <Tip>오른쪽 위 &ldquo;남은 요청 27/30&rdquo;에서 학생이 남은 횟수를 직접 확인할 수 있습니다.</Tip>
        </Section>

        <Section id="dashboard" title="6. 강사 대시보드 사용법">
          <p>수업 목록에서 수업을 누르면 대시보드가 열립니다. 3초마다 자동으로 새로 고쳐집니다.</p>
          <Table
            head={["화면·버튼", "언제 사용합니까"]}
            rows={[
              ["진행 현황표", "학생별 요청 수, 버전 수, 마지막 활동, 만든 앱 제목을 보여 줍니다. 🆘 학생이 맨 위에 먼저 표시됩니다"],
              ["🆘 도움이 필요해 보임", "5분 넘게 활동이 없거나 연속으로 실패한 학생입니다. 먼저 가서 도와주십시오"],
              ["보기", "그 학생의 최신 앱을 크게 열어 봅니다"],
              ["📺 띄우기", "그 학생 앱을 발표 화면에 전체 화면으로 보여 줍니다"],
              ["+5회", "요청을 모두 쓴 학생에게 5회를 더 줍니다"],
              ["🎯 미션 방송", "모든 학생 화면 위쪽에 과제를 띄웁니다. 자주 쓰는 미션은 버튼으로 한 번에 보낼 수 있습니다"],
              ["✋ 전체 일시정지", "설명할 때 학생 입력을 잠급니다. 다시 누르면 풀립니다"],
              ["🔒 입장 잠금", "새 학생이 들어오지 못하게 합니다. 이미 들어온 학생은 그대로입니다"],
              ["+30분 연장", "자동 종료 시각을 30분 늦춥니다 (수업을 만든 뒤 최대 4시간까지)"],
              ["⚙ 한도 설정", "1인 요청 한도, 비용 상한, 정원을 수업 중에 바꿉니다"],
              ["AI 비용", "지금까지 쓴 금액과 상한 대비 막대를 보여 줍니다. 빨갛게 되면 상한을 올리십시오"],
              ["갤러리 / 활동 기록", "학생이 올린 앱과 생성·수정·차단 등 모든 활동을 보여 줍니다"],
            ]}
          />
        </Section>

        <Section id="present" title="7. 발표 화면과 결과 공유">
          <Steps
            items={[
              <>
                <b>📺 발표 화면</b>은 평소에 주소·강의 코드·미션·입장 인원·앱 완성 인원을 크게 보여 줍니다.
              </>,
              <>
                대시보드에서 학생 줄의 <b>📺 띄우기</b>나 갤러리의 <b>📺</b>를 누르면 발표 화면이 그 학생의 앱으로 바뀝니다. 학생이 직접 앞에 나오지
                않아도 시연할 수 있습니다.
              </>,
              <>
                다시 코드 화면으로 돌아가려면 갤러리 위의 <b>발표 화면 비우기</b>를 누르십시오.
              </>,
              <>학생에게 &ldquo;갤러리에 올리기&rdquo;를 안내하면 서로의 앱을 보고 리믹스하며 배울 수 있습니다.</>,
            ]}
          />
        </Section>

        <Section id="finish" title="8. 수업 마무리">
          <Steps
            items={[
              <>
                학생에게 <b>⬇ 다운로드</b>로 HTML 파일을 받도록 안내합니다. 차트처럼 외부 라이브러리를 쓰는 앱은 열 때 인터넷이 필요하다는 점도 알려
                주십시오.
              </>,
              <>
                <b>🗂 갤러리 ZIP</b>으로 학생들이 올린 앱을 한 번에 내려받아 보관할 수 있습니다.
              </>,
              <>
                <b>📄 사용량 보고서</b>(CSV, 엑셀로 열림)로 학생별 AI 호출 수와 비용을 확인합니다. 고객사 정산에 그대로 사용할 수 있습니다.
              </>,
              <>
                <b>■ 수업 종료</b>를 누르면 학생은 더 만들 수 없고 다운로드만 할 수 있습니다. 필요하면 <b>▶ 수업 재개</b>로 다시 열 수 있습니다.
              </>,
              <>
                종료 <b>7일 뒤</b> 학생 결과물과 기록이 자동으로 영구 삭제됩니다(사용량 합계만 남습니다). 바로 지우려면 <b>🗑 삭제</b>를 누르십시오. 삭제는
                되돌릴 수 없으며, 같은 강의 코드는 다시 사용되지 않습니다.
              </>,
            ]}
          />
        </Section>

        <Section id="prompt" title="9. 좋은 요청 작성법 (학생 안내용)">
          <p>수업을 시작할 때 화면에 띄워 함께 읽으면 좋습니다.</p>
          <Table
            head={["이렇게 쓰면 좋습니다", "예시"]}
            rows={[
              ["누가·무엇을 하는 앱인지", "“영업팀이 고객별 견적을 계산하는 앱을 만들어줘”"],
              ["입력과 결과를 구체적으로", "“품목·단가·수량을 넣으면 공급가와 부가세 10%, 총액을 보여줘”"],
              ["한 번에 하나씩 고치기", "“합계 아래에 막대 차트를 넣어줘” → 확인 → 다음 요청"],
              ["보이는 그대로 말하기", "“오른쪽 위 저장 버튼이 너무 작아, 두 배로 키워줘”"],
              ["저장이 필요하면 말하기", "“새로고침해도 입력한 내용이 남게 해줘”"],
              ["모르면 물어보기", "아이디어가 막히면 💬 질문하며 정하기, 코드가 궁금하면 코드 탭의 설명 듣기를 사용합니다"],
            ]}
          />
          <Tip>막혔을 때는 &ldquo;이전 버전(◀)으로 돌아가서 다시 요청하기&rdquo;가 가장 빠른 해결책입니다.</Tip>
        </Section>

        <Section id="trouble" title="10. 자주 생기는 상황과 해결">
          <Table
            head={["상황", "해결"]}
            rows={[
              ["“강의 코드를 다시 확인해 주세요”", "코드 6자리를 다시 확인합니다. 삭제된 수업이거나 다른 수업의 코드일 수 있습니다"],
              ["“이미 끝난 수업이에요”", "수업이 종료된 상태입니다. 4시간 안이라면 대시보드에서 ▶ 수업 재개를 누릅니다. 4시간이 지났다면 새 수업을 만들어 주십시오"],
              ["“정원이 다 찼어요”", "⚙ 한도 설정에서 정원을 늘립니다"],
              ["“강사가 입장을 잠가 두었어요”", "🔓 입장 잠금 해제를 누릅니다"],
              ["학생 요청 횟수를 다 씀", "학생 줄의 +5회를 누릅니다. 학생은 코드 탭에서 직접 고칠 수도 있습니다"],
              ["“이번 수업의 AI 사용 한도에 도달”", "⚙ 한도 설정에서 비용 상한을 올립니다"],
              ["“AI가 잠시 쉬고 있어요”", "요청이 몰린 상태입니다. 30초 뒤 다시 보내면 됩니다(횟수는 차감되지 않습니다)"],
              ["앱에 오류가 남", "미리보기 위 빨간 줄의 “AI로 고치기”를 누르거나 ◀ 이전 버전으로 돌아갑니다"],
              ["요청이 거절됨", "피싱·악성코드·실제 서비스 로그인 화면 흉내 같은 요청은 안전 필터가 막습니다"],
              ["학생이 다른 컴퓨터로 옮김", "첫 화면 “다른 기기에서 하던 작업 이어 하기”에 강의 코드와 복귀 코드를 입력합니다"],
              ["복귀 코드를 잃어버림", "같은 브라우저라면 첫 화면의 이어서 만들기로 들어갈 수 있습니다. 아니면 새 별명으로 입장한 뒤 갤러리에서 리믹스합니다"],
              ["강사 로그인이 안 됨", "등록된 이름과 전화번호(010-0000-0000)가 맞는지 확인하고, 안 되면 메인 관리자에게 문의합니다"],
            ]}
          />
        </Section>

        <Section id="safety" title="11. 안전·개인정보 수칙">
          <Steps
            items={[
              <>
                학생에게 주민등록번호, 실제 고객 명단, 회사 기밀을 요청 문장에 넣지 않도록 안내해 주십시오. 전화번호 같은 정보를 넣으면 화면에 경고가
                표시됩니다.
              </>,
              <>앱 안에서 올리는 CSV·엑셀 파일은 학생 브라우저 안에서만 읽으며 서버로 보내지 않습니다.</>,
              <>API 키나 비밀번호가 필요한 서비스는 코드에 넣지 않도록 합니다. 내려받은 파일은 누구나 열어 볼 수 있습니다.</>,
              <>저장되는 정보는 별명, 요청 문장, 만든 앱 코드, 사용량입니다. 수업 종료 7일 뒤 자동으로 삭제됩니다.</>,
              <>학생은 만 18세 이상만 참여할 수 있습니다.</>,
            ]}
          />
        </Section>

        <p className="border-t border-line pt-8 text-center text-[24px] text-muted">Copyright © (주)드림정보</p>
      </article>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-8">
      <h2 className="border-b-2 border-line pb-3 text-[40px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

type OrderKind = "start" | "must" | "option";

function Badge({ kind }: { kind: OrderKind }) {
  const style =
    kind === "start" ? "bg-ink text-bg" : kind === "must" ? "bg-accent text-accent-fg" : "border-2 border-line bg-surface text-muted";
  const label = kind === "start" ? "시작" : kind === "must" ? "필수" : "선택";
  return <span className={`inline-block shrink-0 rounded-lg px-3 py-0.5 text-[22px] font-bold ${style}`}>{label}</span>;
}

/** 수업 진행 순서: 번호 + 필수/선택 표시 */
function Order({ items }: { items: { kind: OrderKind; title: string; body: React.ReactNode }[] }) {
  return (
    <ol className="space-y-4">
      {items.map((it, i) => (
        <li key={i} className={`card flex gap-5 p-6 ${it.kind === "option" ? "bg-surface-2/40" : ""}`}>
          <span className="mt-1 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent-soft text-[24px] font-bold text-accent">{i + 1}</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <Badge kind={it.kind} />
              <b className="text-[30px]">{it.title}</b>
            </div>
            <div className="mt-2 text-[28px] text-muted">{it.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-5">
          <span className="mt-1 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent-soft text-[24px] font-bold text-accent">{i + 1}</span>
          <div className="min-w-0">{it}</div>
        </li>
      ))}
    </ol>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-[28px]">
        <thead className="bg-surface-2 text-left text-[24px] text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-5 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line align-top">
              {r.map((c, j) => (
                <td key={j} className={`px-5 py-4 ${j === 0 ? "min-w-[6em] font-semibold" : ""}`}>
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
  return <p className="rounded-2xl bg-accent-soft px-7 py-5 text-[28px]">💡 {children}</p>;
}

function Summary({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="card p-7">
      <div className="text-[48px]">{icon}</div>
      <div className="mt-2 text-[32px] font-bold">{title}</div>
      <div className="text-[28px] text-muted">{text}</div>
    </div>
  );
}

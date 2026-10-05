# 만들랩 (Mandllab)

강의 코드 하나로 입장해서 AI와 대화하며 실제로 쓰는 웹 앱을 만들고, HTML 파일로 가져가는 바이브코딩 메이커 도구.

## 바로 실행

```bash
npm install
cp .env.example .env.local   # GEMINI_API_KEY 를 넣으면 실제 AI, 비우면 데모 모드
npm run dev                  # http://localhost:3000
```

DB는 libSQL을 쓴다. 로컬에서는 `data/mandllab.db` 파일이 자동으로 만들어지고, 배포에서는 Turso(`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`)에 연결한다.

## 수업 흐름

| 누가 | 어디서 | 무엇을 |
|---|---|---|
| 강사 | `/teacher` | 가입 → 수업 만들기 (1인 요청 한도, 비용 상한, 정원, 진행 시간) → 6자리 강의 코드 발급 |
| 강사 | `/teacher/{id}/present` | 프로젝터에 코드를 크게 띄운다. 스포트라이트하면 그 앱이 전체 화면으로 |
| 참여자 | `/` | 코드 → 별명 → 만 18세·약관 동의 → **복귀 코드** 발급 → 빌더 |
| 참여자 | `/build` | 시작 카드나 자유 설명으로 생성 → 대화로 수정 → 미리보기·코드·버전 → 갤러리·리믹스 → HTML 다운로드 |
| 강사 | `/teacher/{id}` | 진행 현황(막힘 감지), 미션 방송, 일시정지, 입장 잠금, 연장, 요청 추가 지급, 사용량 CSV, 갤러리 ZIP |

### 코드 인증 규칙
- 강의 코드: 헷갈리는 글자를 뺀 6자리, 한 번 쓴 코드는 다시 발급하지 않음
- 상태: 진행 → (예정 시각 또는 강사 종료) 종료 → 7일 뒤 만료(참여자·결과물·기록 영구 삭제, 사용량 합계만 남음)
- 강사가 삭제하면 즉시 만료
- 복귀 코드: 다른 기기에서 이어 하거나 종료 후 다운로드할 때 사용. 새 기기로 들어오면 이전 기기 접속은 끊김
- 틀린 코드 입력만 IP당 분당 15회로 제한 (한 강의실이 같은 회사망 IP여도 입장이 막히지 않음)

## 구조

```
src/lib/
  db.ts         SQLite 스키마 (instructors, sessions, participants, versions, gallery, logs, usage)
  auth.ts       강사 로그인(쿠키), 참여자 토큰, 시도 제한
  sessions.ts   코드 발급, 시간에 따른 상태 전환과 만료 삭제
  ai.ts         프롬프트, Gemini 스트리밍 호출, 변경분(SEARCH/REPLACE) 적용, 단가
  mock.ts       키 없을 때 쓰는 데모 모드 (실제와 같은 출력 형식)
  queue.ts      동시 호출 제한 대기열
  safety.ts     기본 안전 필터 (피싱·악성코드 차단, 개인정보 경고)
src/app/api/generate   요청 한도·비용 상한·필터 → 대기열 → AI → 변경분 적용(실패 시 전체 재작성) → 버전 저장
src/components/Preview.tsx   sandbox iframe 미리보기 (서비스 쿠키와 격리, 오류 감지 → "AI로 고치기")
```

## 배포 시 주의
- Vercel: `vercel integration add tursocloud/database --plan starter` 로 Turso를 연결하면 환경 변수가 자동으로 들어간다. 연결 전에는 /tmp 임시 저장소로 돌아가 데이터가 유지되지 않는다.
- 동시 호출 대기열과 입장 시도 제한은 서버 인스턴스 메모리에 있다. 인스턴스가 여러 개로 늘면 인스턴스별로 따로 센다.
- 운영 전 `INSTRUCTOR_INVITE_KEY` 를 설정하고, `/terms` 안내문을 실제 약관으로 바꾼다.
- 기업 방화벽: `generativelanguage.googleapis.com`(서버), 참여자 브라우저는 서비스 도메인과 `cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, `unpkg.com` 접근이 필요하다.

import "server-only";
import type { GenerateMode } from "./types";

// GEMINI_API_KEY 가 없을 때 쓰는 데모 모드. 실제 AI와 같은 출력 형식(요약 주석, SEARCH/REPLACE 블록)을 만들어
// 화면·대기열·변경분 적용·버전 관리 흐름을 키 없이 끝까지 시험할 수 있게 한다.

function page(title: string, body: string, script: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  :root { --accent:#5b5bd6; --bg:#f6f7fb; --card:#ffffff; --text:#1d2030; --muted:#6b7085; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif; background:var(--bg); color:var(--text); }
  main { max-width:720px; margin:0 auto; padding:32px 20px; }
  h1 { font-size:1.6rem; margin:0 0 4px; }
  p.sub { color:var(--muted); margin:0 0 24px; }
  .card { background:var(--card); border-radius:16px; padding:20px; box-shadow:0 2px 10px rgba(0,0,0,.06); margin-bottom:16px; }
  label { display:block; font-weight:600; margin:12px 0 6px; }
  input, select, textarea { width:100%; padding:10px 12px; border:1px solid #d5d8e2; border-radius:10px; font-size:1rem; }
  button { background:var(--accent); color:#fff; border:0; border-radius:10px; padding:10px 16px; font-size:1rem; font-weight:600; cursor:pointer; }
  button.ghost { background:transparent; color:var(--accent); border:1px solid var(--accent); }
  .row { display:flex; gap:8px; align-items:center; }
  .big { font-size:2rem; font-weight:800; color:var(--accent); }
  ul { padding-left:20px; }
  footer#notes { color:var(--muted); font-size:.9rem; }
</style>
</head>
<body>
<main>
${body}
<footer id="notes"></footer>
</main>
<script>
${script}
</script>
</body>
</html>`;
}

const TEMPLATES: { match: RegExp; title: string; body: string; script: string }[] = [
  {
    match: /견적|계산|가격|금액/,
    title: "견적 계산기",
    body: `<h1>견적 계산기</h1><p class="sub">품목과 수량을 넣으면 합계와 부가세를 계산해요.</p>
<div class="card"><label for="name">품목</label><input id="name" placeholder="예: 디자인 시안">
<label for="price">단가(원)</label><input id="price" type="number" value="100000">
<label for="qty">수량</label><input id="qty" type="number" value="1">
<p><button id="add">추가</button></p></div>
<div class="card"><ul id="list"></ul><p>공급가 <b id="sum">0</b>원 · 부가세 <b id="vat">0</b>원</p><p class="big" id="total">0원</p></div>`,
    script: `const items=JSON.parse(localStorage.getItem('quote')||'[]');
const fmt=n=>n.toLocaleString('ko-KR');
function render(){list.innerHTML=items.map((it,i)=>'<li>'+it.name+' × '+it.qty+' = '+fmt(it.price*it.qty)+'원 <button class="ghost" onclick="del('+i+')">삭제</button></li>').join('');
const s=items.reduce((a,b)=>a+b.price*b.qty,0);sum.textContent=fmt(s);vat.textContent=fmt(Math.round(s*0.1));total.textContent=fmt(Math.round(s*1.1))+'원';localStorage.setItem('quote',JSON.stringify(items));}
function del(i){items.splice(i,1);render();}
add.onclick=()=>{items.push({name:document.getElementById('name').value||'품목',price:+price.value||0,qty:+qty.value||1});render();};
render();`,
  },
  {
    match: /투표|설문|선호/,
    title: "우리 팀 투표",
    body: `<h1>우리 팀 투표</h1><p class="sub">선택지를 누르면 바로 집계돼요.</p>
<div class="card"><label for="q">질문</label><input id="q" value="점심 뭐 먹을까요?"><div id="opts" style="margin-top:12px"></div>
<div class="row" style="margin-top:12px"><input id="newOpt" placeholder="선택지 추가"><button id="addOpt">추가</button></div></div>`,
    script: `const state=JSON.parse(localStorage.getItem('vote')||'{"opts":{"한식":0,"중식":0,"양식":0}}');
function render(){const total=Object.values(state.opts).reduce((a,b)=>a+b,0)||1;
opts.innerHTML=Object.entries(state.opts).map(([k,v])=>'<p><button style="width:100%;text-align:left" onclick="vote(\\''+k+'\\')">'+k+' — '+v+'표 ('+Math.round(v/total*100)+'%)</button></p>').join('');
localStorage.setItem('vote',JSON.stringify(state));}
function vote(k){state.opts[k]++;render();}
addOpt.onclick=()=>{const v=newOpt.value.trim();if(v){state.opts[v]=0;newOpt.value='';render();}};render();`,
  },
  {
    match: /할\s*일|todo|체크리스트|업무\s*목록/i,
    title: "할 일 목록",
    body: `<h1>할 일 목록</h1><p class="sub">오늘 할 일을 적고 끝나면 체크하세요.</p>
<div class="card"><div class="row"><input id="todo" placeholder="할 일을 입력하세요" aria-label="할 일"><button id="add">추가</button></div><ul id="list"></ul></div>`,
    script: `const todos=JSON.parse(localStorage.getItem('todos')||'[]');
function render(){list.innerHTML=todos.map((t,i)=>'<li><label style="display:inline;font-weight:400"><input type="checkbox" style="width:auto" '+(t.done?'checked':'')+' onchange="toggle('+i+')"> '+(t.done?'<s>'+t.text+'</s>':t.text)+'</label></li>').join('');localStorage.setItem('todos',JSON.stringify(todos));}
function toggle(i){todos[i].done=!todos[i].done;render();}
add.onclick=()=>{if(todo.value.trim()){todos.push({text:todo.value.trim(),done:false});todo.value='';render();}};render();`,
  },
  {
    match: /csv|엑셀|데이터\s*정리|표\s*정리/i,
    title: "데이터 정리기",
    body: `<h1>데이터 정리기</h1><p class="sub">CSV 파일을 올리면 표로 보여주고 열별 합계를 계산해요. 파일은 내 브라우저 안에서만 읽어요.</p>
<div class="card"><label for="file">CSV 파일</label><input id="file" type="file" accept=".csv"></div>
<div class="card" style="overflow:auto"><table id="tbl" style="border-collapse:collapse;width:100%"></table><p id="stat"></p></div>`,
    script: `file.onchange=async()=>{const txt=await file.files[0].text();const rows=txt.trim().split(/\\r?\\n/).map(r=>r.split(','));
tbl.innerHTML=rows.map((r,i)=>'<tr>'+r.map(c=>'<'+(i?'td':'th')+' style="border:1px solid #ddd;padding:6px">'+c+'</'+(i?'td':'th')+'>').join('')+'</tr>').join('');
const sums=rows[0].map((h,j)=>[h,rows.slice(1).reduce((a,r)=>a+(parseFloat(r[j])||0),0)]).filter(x=>x[1]);
stat.textContent=sums.length?'합계: '+sums.map(([h,v])=>h+' '+v.toLocaleString()).join(', '):'숫자 열이 없어요';};`,
  },
  {
    match: /퀴즈|문제|시험/,
    title: "퀴즈 앱",
    body: `<h1>퀴즈 앱</h1><p class="sub">문제를 풀고 점수를 확인하세요.</p><div class="card" id="box"></div>`,
    script: `const qs=[{q:'HTML은 무엇의 약자일까요?',a:['HyperText Markup Language','High Tech Modern Language'],c:0},{q:'웹 페이지에 색과 모양을 입히는 언어는?',a:['JavaScript','CSS'],c:1},{q:'버튼을 눌렀을 때 동작을 만드는 언어는?',a:['JavaScript','SQL'],c:0}];
let i=0,score=0;function show(){if(i>=qs.length){box.innerHTML='<p class="big">'+score+' / '+qs.length+'점</p><button onclick="i=0;score=0;show()">다시 풀기</button>';return;}
box.innerHTML='<p><b>Q'+(i+1)+'.</b> '+qs[i].q+'</p>'+qs[i].a.map((t,j)=>'<p><button class="ghost" style="width:100%" onclick="pick('+j+')">'+t+'</button></p>').join('');}
function pick(j){if(j===qs[i].c)score++;i++;show();}show();`,
  },
  {
    match: /일정|스케줄|캘린더|달력|마감/,
    title: "일정 대시보드",
    body: `<h1>일정 대시보드</h1><p class="sub">일정을 넣으면 남은 날짜 순으로 정리해요.</p>
<div class="card"><label for="t">일정</label><input id="t" placeholder="예: 기획안 제출"><label for="d">날짜</label><input id="d" type="date"><p><button id="add">추가</button></p></div>
<div class="card"><ul id="list"></ul></div>`,
    script: `const evs=JSON.parse(localStorage.getItem('evs')||'[]');
function render(){const today=new Date();today.setHours(0,0,0,0);evs.sort((a,b)=>a.d.localeCompare(b.d));
list.innerHTML=evs.map((e,i)=>{const left=Math.round((new Date(e.d)-today)/86400000);return '<li>'+e.t+' — '+e.d+' <b>'+(left===0?'오늘':left>0?'D-'+left:'지남')+'</b> <button class="ghost" onclick="evs.splice('+i+',1);render()">삭제</button></li>'}).join('');localStorage.setItem('evs',JSON.stringify(evs));}
add.onclick=()=>{if(t.value&&d.value){evs.push({t:t.value,d:d.value});t.value='';render();}};render();`,
  },
];

const COLORS: [RegExp, string][] = [
  [/빨간|빨강|레드|red/i, "#e5484d"],
  [/주황|오렌지|orange/i, "#f76b15"],
  [/노란|노랑|yellow/i, "#d6a100"],
  [/초록|녹색|그린|green/i, "#30a46c"],
  [/파란|파랑|블루|blue/i, "#0090ff"],
  [/보라|퍼플|purple/i, "#8e4ec6"],
  [/분홍|핑크|pink/i, "#d6409f"],
  [/검정|검은|블랙|black/i, "#1d2030"],
];

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function mockOutput(mode: GenerateMode, prompt: string, baseHtml?: string, fullRewrite = false): string {
  if (mode === "explain") {
    return `이 앱은 크게 세 부분으로 되어 있어요.\n\n1. **HTML** — 화면에 보이는 뼈대(제목, 입력칸, 버튼)예요.\n2. **CSS** (<style> 안) — 색, 크기, 간격 같은 옷차림이에요. \`--accent\` 값을 바꾸면 대표 색이 바뀌어요.\n3. **JavaScript** (<script> 안) — 버튼을 눌렀을 때 일어나는 일을 정해요. \`localStorage\`(브라우저 안의 작은 저장 공간)에 내용을 저장해서 새로고침해도 남아요.\n\n(데모 모드 답변이에요. Gemini 키를 연결하면 질문 "${prompt.slice(0, 40)}"에 맞춘 설명을 해 줘요.)`;
  }

  if (mode === "create" || !baseHtml) {
    const t = TEMPLATES.find((x) => x.match.test(prompt));
    const html = t
      ? page(t.title, t.body, t.script)
      : page(
          "나의 첫 앱",
          `<h1>나의 첫 앱</h1><p class="sub">요청: ${escapeHtml(prompt.slice(0, 80))}</p>
<div class="card"><p>버튼을 누르면 숫자가 올라가요.</p><p class="big" id="count">0</p><button id="btn">눌러 보기</button></div>`,
          `let n=+localStorage.getItem('count')||0;count.textContent=n;btn.onclick=()=>{n++;count.textContent=n;localStorage.setItem('count',n);};`,
        );
    const title = t?.title ?? "나의 첫 앱";
    return `<!-- 요약: '${title}'을 만들었어요. (데모 모드: 요청 내용에 맞는 예시 앱을 보여줘요) -->\n${html}`;
  }

  const color = COLORS.find(([re]) => re.test(prompt));
  const accent = baseHtml.match(/--accent:\s*([^;]+);/);
  const note = `<p>✔ 반영한 요청: ${escapeHtml(prompt.slice(0, 80))}</p>`;

  if (fullRewrite || !baseHtml.includes('<footer id="notes">')) {
    const html = baseHtml.replace(/<\/body>/i, `<footer id="notes">${note}</footer>\n</body>`);
    return `<!-- 요약: 요청을 반영해 앱 전체를 다시 정리했어요. (데모 모드) -->\n${html}`;
  }
  if (color && accent) {
    return `<!-- 요약: 앱의 대표 색을 바꿨어요. (데모 모드) -->
<<<<<<< SEARCH
--accent:${accent[1]};
=======
--accent:${color[1]};
>>>>>>> REPLACE`;
  }
  return `<!-- 요약: 요청 내용을 앱 아래쪽 메모에 기록했어요. 데모 모드라 실제 기능은 바뀌지 않아요. -->
<<<<<<< SEARCH
<footer id="notes">
=======
<footer id="notes">${note}
>>>>>>> REPLACE`;
}

export async function streamMock(text: string, onDelta: (s: string) => void, signal?: AbortSignal) {
  const step = 120;
  for (let i = 0; i < text.length; i += step) {
    if (signal?.aborted) break;
    onDelta(text.slice(i, i + step));
    await new Promise((r) => setTimeout(r, 15));
  }
  // 대략적인 토큰 수 (한국어 섞인 HTML 기준 글자 3개당 1토큰)
  return { text, inputTokens: 0, outputTokens: Math.ceil(text.length / 3) };
}

/** 데모 모드의 "질문으로 시작하기": 첫 말에는 질문, 답을 받은 뒤에는 설계안 */
export function mockPlan(prompt: string, answeredRounds: number, hasApp: boolean): string {
  const idea = prompt.slice(0, 40);
  if (answeredRounds === 0 && !/바로|알아서|정리/.test(prompt)) {
    return JSON.stringify({
      message: `'${idea}' 좋은 생각이에요! 몇 가지만 골라 주시면 딱 맞는 앱으로 정리해 드릴게요. (데모 모드 예시 질문)`,
      questions: [
        { id: "q1", question: "이 앱은 주로 누가 쓰나요?", type: "single", options: ["나 혼자", "우리 팀", "고객·외부 사람"], allowOther: true },
        { id: "q2", question: "꼭 있어야 하는 기능을 골라 주세요", type: "multi", options: ["입력하고 목록으로 보기", "합계·통계 보기", "차트로 보기", "CSV로 내려받기"], allowOther: true },
        { id: "q3", question: "화면 분위기는 어떤 게 좋아요?", type: "single", options: ["깔끔한 흰색", "산뜻한 파스텔", "차분한 다크 모드"], allowOther: false },
      ],
      plan: null,
    });
  }
  return JSON.stringify({
    message: "답해 주신 내용으로 설계안을 정리했어요. 마음에 들면 '이대로 만들기'를 눌러 주세요. (데모 모드 예시 설계안)",
    questions: [],
    plan: {
      title: hasApp ? "기능을 더한 내 앱" : "나의 맞춤 앱",
      summary: `${idea}을(를) 위한 간단한 기록 앱이에요.`,
      features: ["항목 입력과 목록 보기", "합계·통계 보기", "브라우저에 자동 저장"],
      later: ["차트로 보기", "CSV로 내려받기"],
      prompt: hasApp
        ? `지금 앱에 합계·통계를 보여주는 영역을 추가해줘. 요청 배경: ${prompt}`
        : `${prompt}. 항목을 입력하면 목록에 쌓이고 합계와 통계를 보여주는 앱을 만들어줘. 데이터는 브라우저에 저장하고 깔끔한 디자인으로.`,
    },
  });
}

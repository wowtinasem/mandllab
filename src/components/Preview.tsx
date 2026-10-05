"use client";

import { useEffect, useMemo, useRef } from "react";

/**
 * 생성 앱 미리보기.
 * sandbox 에 allow-same-origin 을 주지 않아 앱은 고유 출처 없이(opaque origin) 실행된다.
 * 서비스 쿠키·저장소에 접근할 수 없으므로 참여자 세션과 격리된다.
 * 그 대신 localStorage 가 막히므로, 미리보기 동안만 쓰는 대체 저장소를 주입하고 값은 부모 창이 보관한다.
 */
const HELPER = (initial: string) => `<script>(function(){
var init=${initial};
function mk(seed,kind){var s=Object.assign({},seed||{});function sync(){try{parent.postMessage({__ml:'storage',kind:kind,data:s},'*')}catch(e){}}
return{getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(s,k)?s[k]:null},setItem:function(k,v){s[String(k)]=String(v);sync()},removeItem:function(k){delete s[String(k)];sync()},clear:function(){s={};sync()},key:function(i){return Object.keys(s)[i]||null},get length(){return Object.keys(s).length}}}
var blocked=false;try{window.localStorage.getItem('__t')}catch(e){blocked=true}
if(blocked){try{Object.defineProperty(window,'localStorage',{value:mk(init.local,'local'),configurable:true});Object.defineProperty(window,'sessionStorage',{value:mk({},'session'),configurable:true})}catch(e){}}
function report(m){try{parent.postMessage({__ml:'error',message:String(m).slice(0,500)},'*')}catch(e){}}
window.addEventListener('error',function(e){report((e.message||'오류')+(e.lineno?' (줄 '+e.lineno+')':''))});
window.addEventListener('unhandledrejection',function(e){var r=e.reason;report('Promise 오류: '+(r&&r.message?r.message:r))});
})();</script>`;

// 미리보기 앱이 저장한 값. 버전을 바꾸거나 화면을 다시 열어도 같은 앱이면 이어서 보여준다.
const previewStores = new Map<string, Record<string, string>>();

function inject(html: string, storage: Record<string, string>): string {
  const helper = HELPER(JSON.stringify({ local: storage }).replace(/</g, "\\u003c"));
  const head = html.match(/<head[^>]*>/i);
  if (head) return html.replace(head[0], head[0] + helper);
  const htmlTag = html.match(/<html[^>]*>/i);
  if (htmlTag) return html.replace(htmlTag[0], htmlTag[0] + helper);
  return helper + html;
}

export default function Preview({
  html,
  storageKey,
  onError,
  className = "",
  title = "앱 미리보기",
}: {
  html: string;
  storageKey?: string;
  onError?: (message: string) => void;
  className?: string;
  title?: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow || !e.data || typeof e.data !== "object") return;
      if (e.data.__ml === "error") onErrorRef.current?.(String(e.data.message));
      if (e.data.__ml === "storage" && e.data.kind === "local" && storageKey) previewStores.set(storageKey, e.data.data);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [storageKey]);

  const srcDoc = useMemo(() => inject(html, (storageKey && previewStores.get(storageKey)) || {}), [html, storageKey]);

  return (
    <iframe
      ref={ref}
      title={title}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"
      // 앱 안의 "복사하기" 버튼이 동작하도록 클립보드 쓰기만 허용 (읽기는 허용하지 않음)
      allow="clipboard-write"
      className={`h-full w-full border-0 bg-white ${className}`}
    />
  );
}

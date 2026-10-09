import "server-only";

/**
 * AI가 만든 앱이 불러오는 외부 주소(라이브러리, 스타일)를 실제로 열어 보고 없는 주소를 찾는다.
 * 없는 주소(404/410)만 "깨짐"으로 보고, 네트워크 문제처럼 확실하지 않은 경우는 깨짐으로 보지 않는다.
 */

const g = globalThis as unknown as { __mlUrlCache?: Map<string, { ok: boolean; at: number }> };
const cache = (g.__mlUrlCache ??= new Map());
const CACHE_MS = 6 * 3600_000;

export function extractExternalUrls(html: string): string[] {
  const urls = new Set<string>();
  const add = (u: string) => {
    if (/^https?:\/\//i.test(u)) urls.add(u.trim());
  };
  for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)) if (/stylesheet|modulepreload/i.test(m[0])) add(m[1]);
  for (const m of html.matchAll(/\bimport\s*(?:[\w*{}\s,]+\s*from\s*)?["'](https?:\/\/[^"']+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/\bimport\(\s*["'](https?:\/\/[^"']+)["']\s*\)/gi)) add(m[1]);
  // <style> 안의 @import url('...') / @import "..." (글꼴을 이렇게 불러오는 경우가 많다)
  for (const m of html.matchAll(/@import\s+(?:url\(\s*)?["']?(https?:\/\/[^"')\s]+)["']?\s*\)?/gi)) add(m[1]);
  return [...urls].slice(0, 15);
}

async function isBroken(url: string): Promise<boolean> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return !hit.ok;
  let broken = false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctrl.signal });
    if (res.status === 405 || res.status === 403) res = await fetch(url, { method: "GET", redirect: "follow", signal: ctrl.signal });
    clearTimeout(timer);
    // 구글 폰트는 없는 글꼴 이름이면 400 을 돌려준다
    broken = res.status === 404 || res.status === 410 || (res.status === 400 && /fonts\.googleapis\.com/i.test(url));
  } catch {
    broken = false; // 시간 초과·네트워크 문제는 판단하지 않는다
  }
  cache.set(url, { ok: !broken, at: Date.now() });
  return broken;
}

/** 없는 외부 주소 목록 (없으면 빈 배열) */
export async function findBrokenUrls(html: string): Promise<string[]> {
  const urls = extractExternalUrls(html);
  const results = await Promise.all(urls.map(async (u) => ((await isBroken(u)) ? u : null)));
  return results.filter((u): u is string => Boolean(u));
}

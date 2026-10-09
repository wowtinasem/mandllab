"use client";

import { use, useEffect, useState } from "react";
import Preview from "@/components/Preview";
import QrCode, { joinUrl } from "@/components/QrCode";
import { api } from "@/lib/client";
import type { Session } from "@/lib/types";

type Dash = { session: Session; participants: { id: string; version_count: number }[] };

/** 프로젝터용 화면: 평소에는 강의 코드를 크게, 스포트라이트가 있으면 그 앱을 전체 화면으로 */
export default function Present({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<Dash | null>(null);
  const [spot, setSpot] = useState<{ id: string; title: string; nickname: string; html: string } | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 브라우저에서만 알 수 있는 접속 주소
    setOrigin(window.location.origin);
    const load = () => api<Dash>(`/api/sessions/${id}`).then(setD).catch(() => {});
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [id]);

  const spotId = d?.session.spotlight_version_id ?? null;
  useEffect(() => {
    if (!spotId || spot?.id === spotId) return;
    api<{ title: string; nickname: string; html: string }>(`/api/versions/${spotId}`)
      .then((v) => setSpot({ id: spotId, ...v }))
      .catch(() => setSpot(null));
  }, [spotId, spot?.id]);

  if (!d) return <div className="grid h-dvh place-items-center text-muted">불러오는 중…</div>;
  const s = d.session;

  if (spot && spot.id === spotId) {
    return (
      <div className="flex h-dvh flex-col bg-bg">
        <div className="flex items-center gap-4 border-b border-line bg-surface px-6 py-3">
          <span className="text-2xl">📺</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-2xl font-extrabold">{spot.title}</div>
            <div className="text-muted">{spot.nickname}님의 앱</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted">강의 코드</div>
            <div className="font-mono text-2xl font-extrabold tracking-[0.25em] text-accent">{s.code}</div>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <Preview html={spot.html} storageKey={`present:${spot.id}`} title={spot.title} />
        </div>
      </div>
    );
  }

  const built = d.participants.filter((p) => p.version_count > 0).length;
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-8 bg-bg p-8 text-center">
      <div className="text-3xl font-bold text-muted">{s.title}</div>
      <div className="flex flex-wrap items-center justify-center gap-x-16 gap-y-8">
        <div>
          <div className="text-2xl text-muted">
            <b className="text-ink">{origin.replace(/^https?:\/\//, "")}</b> 에 접속해서 코드를 입력하세요
          </div>
          <div className="mt-6 font-mono text-[clamp(4rem,12vw,11rem)] font-black leading-none tracking-[0.2em] text-accent">{s.code}</div>
        </div>
        {origin && s.status === "active" && (
          <div className="flex flex-col items-center gap-3">
            <QrCode text={joinUrl(origin, s.code)} className="w-[min(32vh,28vw)] shadow-lg" label={`강의 코드 ${s.code} 입장 QR 코드`} />
            <div className="text-xl font-semibold text-muted">📱 휴대폰 카메라로 찍으면 바로 입장</div>
          </div>
        )}
      </div>
      {s.status !== "active" ? (
        <div className="rounded-full bg-warn-soft px-6 py-2 text-xl font-semibold text-warn">수업이 종료되었어요</div>
      ) : s.locked ? (
        <div className="rounded-full bg-warn-soft px-6 py-2 text-xl font-semibold text-warn">입장이 잠겨 있어요</div>
      ) : null}
      {s.mission && s.status === "active" && (
        <div className="max-w-3xl rounded-2xl bg-accent-soft px-8 py-4 text-2xl font-bold text-accent">🎯 {s.mission}</div>
      )}
      <div className="flex gap-10 text-xl">
        <div>
          <div className="text-5xl font-extrabold">{d.participants.length}</div>
          <div className="text-muted">명 입장</div>
        </div>
        <div>
          <div className="text-5xl font-extrabold">{built}</div>
          <div className="text-muted">명 앱 완성</div>
        </div>
      </div>
    </div>
  );
}

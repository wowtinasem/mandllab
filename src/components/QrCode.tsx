"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** 주소를 QR 코드(SVG)로 그린다. 프로젝터에서도 잘 찍히도록 흰 바탕·검은 점으로 고정 */
export default function QrCode({ text, className = "", label = "QR 코드" }: { text: string; className?: string; label?: string }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let alive = true;
    QRCode.toString(text, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(""));
    return () => {
      alive = false;
    };
  }, [text]);

  return (
    <div
      role="img"
      aria-label={label}
      className={`aspect-square rounded-2xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full ${className}`}
      // qrcode 라이브러리가 만든 SVG 문자열 (주소만 담기고 사용자 입력 HTML은 들어가지 않는다)
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** 학생이 찍으면 강의 코드가 채워진 입장 화면이 열리는 주소 */
export function joinUrl(origin: string, code: string) {
  return `${origin}/?code=${encodeURIComponent(code)}`;
}

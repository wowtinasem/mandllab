import "server-only";

/**
 * AI 제작 지시문에 넣는 "검증된 라이브러리 목록"과 사진·이미지 앱 규칙.
 * 아래 주소는 실제로 열리는 것을 확인했고, 만들랩 미리보기(sandbox) 안에서도 동작을 확인했다.
 * AI가 없는 주소(404)를 지어내 앱이 멈추는 일을 줄이기 위한 목록이다. 주소를 바꾸면 반드시 다시 확인할 것.
 */
export const LIBRARY_GUIDE = `[검증된 라이브러리 목록 — 외부 라이브러리는 되도록 아래 주소와 사용법을 그대로 쓴다. 버전 번호를 바꾸거나 주소를 지어내지 않는다]
- 사진 자르기·회전: <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css"> + <script src="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js"></script> → new Cropper(imgEl, { viewMode: 1 }); cropper.rotate(90); cropper.getCroppedCanvas()
- 배경 제거(브라우저 안 AI 모델, 처음 한 번 약 40MB 내려받음): <script type="module"> import { removeBackground } from "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm"; const pngBlob = await removeBackground(fileOrBlob, { progress: (key, cur, total) => {...} }); </script> (전역 함수가 아니라 module import 로만 쓴다. 모듈 안의 함수는 버튼에 addEventListener 로 연결한다)
- 사진 속 글자 읽기(OCR): <script src="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js"></script> → const r = await Tesseract.recognize(file, 'kor+eng', { logger: m => ... }); r.data.text
- 그림 그리기·스티커·글자 올리기: <script src="https://cdn.jsdelivr.net/npm/fabric@5.3.0/dist/fabric.min.js"></script> → new fabric.Canvas('id'), fabric.Image.fromURL(url, img => canvas.add(img)), new fabric.IText('글자')
- 사진 용량 줄이기: <script src="https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.js"></script> → await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920 })
- 화면을 이미지로 저장: <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script> → (await html2canvas(el)).toBlob(...)
- 차트: https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js (new Chart(ctx, {...}))
- CSV: https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js / 엑셀: https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
- PDF 만들기: https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js (const { jsPDF } = window.jspdf)
- QR 코드: https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js (new QRCode(el, { text, width: 200, height: 200 }))
- 날짜: https://cdn.jsdelivr.net/npm/dayjs@1.11.13/dayjs.min.js / 끌어서 순서 바꾸기: https://cdn.jsdelivr.net/npm/sortablejs@1.15.3/Sortable.min.js / 축하 효과: https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js
- 디자인: https://cdn.tailwindcss.com (선택). 아이콘이 필요하면 이모지나 인라인 SVG 를 쓴다.
- 한글 글꼴: Pretendard 는 구글 폰트에 없다. <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"> (font-family: "Pretendard Variable") 또는 구글 폰트 Noto Sans KR: https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap`;

export const IMAGE_GUIDE = `[사진·이미지 앱 규칙 — 사진 편집기, 필터, 꾸미기, 배경 제거, 글자 읽기 등을 만들 때]
- 사진 넣기: <input type="file" accept="image/*"> 와 끌어다 놓기(drag & drop)를 모두 지원한다. 휴대폰 촬영은 같은 input 에 capture="environment" 를 둔 별도 버튼으로 지원한다. (미리보기 안에서는 getUserMedia 카메라가 막힐 수 있다)
- 사진을 고르기 전에도 화면이 비어 보이지 않게 "사진을 올려 주세요" 안내 영역을 크게 보여 준다. 외부 예시 이미지 주소(unsplash, picsum 등)는 쓰지 않는다. 깨지기 쉽고 캔버스 저장을 막는다.
- 읽기: URL.createObjectURL(file) 또는 FileReader 로 Image 를 만들고 onload 뒤에 그린다. 큰 사진은 긴 변 2000px 이하로 줄여 캔버스에 그린다(속도·메모리).
- 편집은 <canvas> 에서 한다. 원본 Image 를 따로 보관하고, 슬라이더를 움직일 때마다 원본에서 다시 그린다(효과가 겹쳐 쌓여 화질이 떨어지지 않게).
- 필터는 ctx.filter = "brightness(110%) contrast(120%) saturate(130%) grayscale(100%) sepia(100%) blur(2px) hue-rotate(30deg)" 처럼 조합해 drawImage 전에 지정한다. 직접 픽셀을 다룰 때는 getImageData/putImageData.
- 회전·뒤집기는 ctx.translate / rotate / scale 로 하고, 90도 회전이면 캔버스 가로·세로를 바꾼다.
- 저장: canvas.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = '이름.png'; a.click(); }, 'image/png'). 화면에 보이는 것과 같은 크기·효과로 저장되게 한다.
- 사진 데이터는 localStorage 에 넣지 않는다(5MB 한계로 오류가 난다). 설정값만 저장한다.
- 오래 걸리는 처리(배경 제거, 글자 읽기)는 진행 표시를 보여 주고, 처리 중에는 버튼을 막고, 실패하면 이유를 화면에 알려 준다.
- 사진 생성, 얼굴 바꾸기처럼 외부 AI 서비스(API 키)가 필요한 기능은 만들 수 없다. "AI" 를 요청받으면 위 목록의 브라우저 안 AI(배경 제거, 글자 읽기)와 필터·자동 보정으로 구현하고, 요약에서 할 수 있는 것과 없는 것을 한 문장으로 알린다.
- 원본과 결과를 나란히 또는 전·후 비교로 볼 수 있게 하면 좋다.`;

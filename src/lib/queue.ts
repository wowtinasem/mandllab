import "server-only";

// 서버 전체 AI 동시 호출 수를 제한하는 대기열. 40명이 한꺼번에 눌러도 실패 대신 순서대로 처리한다.
type Waiter = { resolve: () => void; onPosition: (pos: number) => void };

const g = globalThis as unknown as { __mlQueue?: { active: number; waiting: Waiter[] } };
const q = (g.__mlQueue ??= { active: 0, waiting: [] });

const limit = () => Math.max(1, Number(process.env.AI_MAX_CONCURRENT) || 8);

function notifyPositions() {
  q.waiting.forEach((w, i) => w.onPosition(i + 1));
}

export async function acquireSlot(onPosition: (pos: number) => void): Promise<() => void> {
  if (q.active < limit()) {
    q.active++;
  } else {
    await new Promise<void>((resolve) => {
      q.waiting.push({ resolve, onPosition });
      onPosition(q.waiting.length);
    });
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = q.waiting.shift();
    if (next) {
      next.resolve(); // 슬롯을 그대로 넘긴다
      notifyPositions();
    } else {
      q.active--;
    }
  };
}

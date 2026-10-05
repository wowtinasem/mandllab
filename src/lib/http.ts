import "server-only";

export const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function readJson<T extends object>(req: Request): Promise<Partial<T>> {
  try {
    const v = await req.json();
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

'use server';
/* 설정 (3n): 색인 안내 일수 · 하루 발행 상한 · 묶음 제외 기준 · 외부 연동 값 — 최고 관리자 · 제작 담당 */
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePerm } from '@/lib/auth';

const LIMITS = {
  index_days: [7, 60], cap_per_partner: [1, 200], cap_total: [1, 2000], review_min_unique: [10, 80], review_min_photos: [1, 10]
} as const;
export type NumKey = keyof typeof LIMITS;

async function put(key: string, value: unknown, userId: string) {
  const db = await getDb();
  const [has] = await db.select({ key: t.settings.key }).from(t.settings).where(eq(t.settings.key, key)).limit(1);
  if (has) await db.update(t.settings).set({ value: value as object }).where(eq(t.settings.key, key));
  else await db.insert(t.settings).values({ key, value: value as object });
  await db.insert(t.auditLogs).values({ userId, action: '설정 변경', targetType: 'setting', targetId: key, detail: { value: key === 'payment_key' ? '(가림)' : value } });
  revalidatePath('/', 'layout');
}

export async function setNumber(key: NumKey, n: number) {
  const u = await requirePerm('설정 · 외부 연동 값');
  const [lo, hi] = LIMITS[key] ?? [];
  if (lo === undefined || !Number.isFinite(n)) return { ok: false as const };
  const v = Math.min(hi, Math.max(lo, Math.round(n)));
  await put(key, v, u.id);
  return { ok: true as const, value: v };
}

/** 외부 연동 값: 결제 키 · 알림톡 템플릿 코드 2개 */
export async function setIntegration(key: 'payment_key' | 'alim1' | 'alim2', raw: string) {
  const u = await requirePerm('설정 · 외부 연동 값');
  const v = raw.trim();
  if (v && !/^[\w.-]{3,120}$/.test(v)) return { ok: false as const, error: '영문 · 숫자 · _ . - 만 쓸 수 있어요' };
  if (key === 'payment_key') { await put('payment_key', v, u.id); return { ok: true as const }; }
  const db = await getDb();
  const [row] = await db.select().from(t.settings).where(eq(t.settings.key, 'alimtalk_codes')).limit(1);
  const codes = Array.isArray(row?.value) ? [...(row.value as string[])] : ['', ''];
  codes[key === 'alim1' ? 0 : 1] = v;
  await put('alimtalk_codes', codes, u.id);
  return { ok: true as const };
}

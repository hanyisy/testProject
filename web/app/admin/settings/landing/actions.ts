'use server';
/* 랜딩 관리: 실제 검색 화면 캡처(흐림은 화면에서 이미지에 입혀서 올림) · 랜딩 "실제 값 입력" 값 — 최고 관리자 · 관리팀 */
import { revalidatePath } from 'next/cache';
import { eq, max } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePerm } from '@/lib/auth';
import { contentHash, putFile } from '@/lib/adapters/storage';
import { CAPTURE_INDUSTRIES, type LandingValues } from '@/lib/landing';
import { isUuid } from '@/lib/partners';

const done = () => revalidatePath('/admin/settings/landing');

export async function addCapture(fd: FormData) {
  const u = await requirePerm('랜딩 관리');
  const file = fd.get('file');
  const query = String(fd.get('query') ?? '').trim();
  const industry = String(fd.get('industry') ?? '');
  const partnerId = String(fd.get('partnerId') ?? '');
  const capturedOn = String(fd.get('capturedOn') ?? '');
  const blur = JSON.parse(String(fd.get('blur') ?? '[]')) as { x: number; y: number; w: number; h: number }[];
  if (!(file instanceof File) || !file.size || file.size > 8 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(file.type)) return { ok: false as const, error: '캡처 이미지(8MB 이하 JPG · PNG)를 골라 주세요' };
  if (!query) return { ok: false as const, error: '검색어를 입력해 주세요' };
  if (!CAPTURE_INDUSTRIES.includes(industry as never)) return { ok: false as const, error: '업종을 골라 주세요' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(capturedOn)) return { ok: false as const, error: '캡처한 날을 골라 주세요' };
  const data = Buffer.from(await file.arrayBuffer());
  const key = `landing/${contentHash(data)}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`;
  await putFile(key, data);
  const db = await getDb();
  const [{ m }] = await db.select({ m: max(t.landingCaptures.sort) }).from(t.landingCaptures);
  const [row] = await db.insert(t.landingCaptures).values({
    imageKey: key, query, industry, partnerId: isUuid(partnerId) ? partnerId : null, capturedOn, visible: true, sort: (m ?? 0) + 1,
    blur: Array.isArray(blur) ? blur.slice(0, 30) : [], createdBy: u.id
  }).returning();
  await db.insert(t.auditLogs).values({ userId: u.id, action: '랜딩 캡처 추가', targetType: 'capture', targetId: row.id, detail: { query } });
  done();
  return { ok: true as const };
}

export async function setCaptureVisible(id: string, visible: boolean) {
  await requirePerm('랜딩 관리');
  if (!isUuid(id)) return;
  const db = await getDb();
  await db.update(t.landingCaptures).set({ visible }).where(eq(t.landingCaptures.id, id));
  done();
}

/** 순서 바꾸기: 위 · 아래 이웃과 자리 바꿈 */
export async function moveCapture(id: string, dir: -1 | 1) {
  await requirePerm('랜딩 관리');
  if (!isUuid(id)) return;
  const db = await getDb();
  const rows = (await db.select({ id: t.landingCaptures.id, sort: t.landingCaptures.sort }).from(t.landingCaptures)).sort((a, b) => a.sort - b.sort);
  const i = rows.findIndex((r) => r.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  rows.forEach((r, k) => { r.sort = k + 1; });
  [rows[i].sort, rows[j].sort] = [rows[j].sort, rows[i].sort];
  for (const r of [rows[i], rows[j]]) await db.update(t.landingCaptures).set({ sort: r.sort }).where(eq(t.landingCaptures.id, r.id));
  for (const r of rows.filter((_, k) => k !== i && k !== j)) await db.update(t.landingCaptures).set({ sort: r.sort }).where(eq(t.landingCaptures.id, r.id));
  done();
}

export async function deleteCapture(id: string) {
  const u = await requirePerm('랜딩 관리');
  if (!isUuid(id)) return;
  const db = await getDb();
  await db.delete(t.landingCaptures).where(eq(t.landingCaptures.id, id));
  await db.insert(t.auditLogs).values({ userId: u.id, action: '랜딩 캡처 삭제', targetType: 'capture', targetId: id });
  done();
}

export async function saveLandingValues(v: LandingValues) {
  const u = await requirePerm('랜딩 관리');
  const n = (x: unknown) => (x === null || x === '' || x === undefined ? null : Number.isFinite(Number(x)) && Number(x) >= 0 ? Math.round(Number(x)) : null);
  const s = (x: unknown, max = 120) => String(x ?? '').trim().slice(0, max);
  const clean: LandingValues = {
    industries: n(v.industries), pages: n(v.pages), monthlyPages: n(v.monthlyPages), fixDays: n(v.fixDays), indexDays: n(v.indexDays),
    business: { ceo: s(v.business.ceo, 40), bizNo: s(v.business.bizNo, 20), address: s(v.business.address), email: s(v.business.email), phone: s(v.business.phone, 20) }
  };
  if (clean.business.bizNo && !/^\d{3}-\d{2}-\d{5}$/.test(clean.business.bizNo)) return { ok: false as const, error: '사업자등록번호는 000-00-00000 형식이에요' };
  const db = await getDb();
  const [has] = await db.select({ key: t.settings.key }).from(t.settings).where(eq(t.settings.key, 'landing_values')).limit(1);
  if (has) await db.update(t.settings).set({ value: clean }).where(eq(t.settings.key, 'landing_values'));
  else await db.insert(t.settings).values({ key: 'landing_values', value: clean });
  await db.insert(t.auditLogs).values({ userId: u.id, action: '랜딩 값 저장', targetType: 'setting', targetId: 'landing_values' });
  done();
  return { ok: true as const };
}

'use server';
/* 업종 템플릿 (3h): 새 업종 · 코드 변경 · 삭제(쓰는 파트너가 있으면 잠김) · 상태 · 항목 더하기/빼기 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq, max, ne } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePerm } from '@/lib/auth';
import { isUuid } from '@/lib/partners';
import { TEMPLATE_GROUPS } from '@/lib/constants';

const CODE = /^[a-z][a-z0-9-]{1,30}$/;
const GROUPS = TEMPLATE_GROUPS;
type Group = (typeof GROUPS)[number];

async function usage(industryId: string) {
  const db = await getDb();
  const rows = await db.select({ status: t.partners.status }).from(t.partners).where(eq(t.partners.industryId, industryId));
  return { active: rows.filter((r) => r.status !== '종료').length, any: rows.length };
}
const done = () => revalidatePath('/admin/templates');

export async function addIndustry(fd: FormData) {
  const u = await requirePerm('업종 템플릿');
  const name = String(fd.get('name') ?? '').trim();
  const code = String(fd.get('code') ?? '').trim().toLowerCase();
  if (!name || !CODE.test(code)) return { ok: false as const, error: '업종명과 코드(영문 소문자 · 숫자 · -)를 확인해 주세요' };
  const db = await getDb();
  const [dup] = await db.select({ id: t.industries.id }).from(t.industries).where(eq(t.industries.code, code)).limit(1);
  if (dup) return { ok: false as const, error: '이미 있는 코드예요' };
  const [{ m }] = await db.select({ m: max(t.industries.sort) }).from(t.industries);
  const [row] = await db.insert(t.industries).values({ name, code, sort: (m ?? 0) + 1 }).returning();
  await db.insert(t.auditLogs).values({ userId: u.id, action: '업종 추가', targetType: 'industry', targetId: row.id, detail: { name, code } });
  redirect(`/admin/templates?i=${code}`);
}

export async function changeCode(id: string, raw: string) {
  const u = await requirePerm('업종 템플릿');
  if (!isUuid(id)) return { ok: false as const, error: '업종을 찾을 수 없어요' };
  const use = await usage(id);
  if (use.active) return { ok: false as const, error: `활성 파트너 ${use.active}곳이 사용 중이라 변경할 수 없어요` };
  const code = raw.trim().toLowerCase();
  if (!CODE.test(code)) return { ok: false as const, error: '코드는 영문 소문자 · 숫자 · - 로 써 주세요' };
  const db = await getDb();
  const [dup] = await db.select({ id: t.industries.id }).from(t.industries).where(and(eq(t.industries.code, code), ne(t.industries.id, id))).limit(1);
  if (dup) return { ok: false as const, error: '이미 있는 코드예요' };
  await db.update(t.industries).set({ code }).where(eq(t.industries.id, id));
  await db.insert(t.auditLogs).values({ userId: u.id, action: '업종 코드 변경', targetType: 'industry', targetId: id, detail: { code } });
  done();
  return { ok: true as const, code };
}

/** 삭제: 활성 파트너가 쓰면 잠김 · 종료 파트너 기록이 남아 있으면 지우지 않고 "보관" */
export async function deleteIndustry(id: string) {
  const u = await requirePerm('업종 템플릿');
  if (!isUuid(id)) return { ok: false as const, error: '업종을 찾을 수 없어요' };
  const use = await usage(id);
  if (use.active) return { ok: false as const, error: `활성 파트너 ${use.active}곳이 사용 중이라 변경할 수 없어요` };
  const db = await getDb();
  if (use.any) {
    await db.update(t.industries).set({ status: '보관' }).where(eq(t.industries.id, id));
    await db.insert(t.auditLogs).values({ userId: u.id, action: '업종 보관', targetType: 'industry', targetId: id });
    done();
    return { ok: true as const, archived: true };
  }
  await db.delete(t.industryItems).where(eq(t.industryItems.industryId, id));
  await db.delete(t.industries).where(eq(t.industries.id, id));
  await db.insert(t.auditLogs).values({ userId: u.id, action: '업종 삭제', targetType: 'industry', targetId: id });
  redirect('/admin/templates');
}

export async function setIndustryStatus(id: string, status: '사용 가능' | '신규 중지' | '보관') {
  await requirePerm('업종 템플릿');
  if (!isUuid(id) || !['사용 가능', '신규 중지', '보관'].includes(status)) return;
  const db = await getDb();
  await db.update(t.industries).set({ status }).where(eq(t.industries.id, id));
  done();
}

export async function addItem(id: string, group: Group, raw: string) {
  await requirePerm('업종 템플릿');
  const label = raw.trim();
  if (!isUuid(id) || !GROUPS.includes(group) || !label) return;
  const db = await getDb();
  const [dup] = await db.select({ id: t.industryItems.id }).from(t.industryItems)
    .where(and(eq(t.industryItems.industryId, id), eq(t.industryItems.group, group), eq(t.industryItems.label, label))).limit(1);
  if (dup) return;
  const [{ m }] = await db.select({ m: max(t.industryItems.sort) }).from(t.industryItems).where(eq(t.industryItems.industryId, id));
  await db.insert(t.industryItems).values({ industryId: id, group, label, sort: (m ?? 0) + 1 });
  done();
}

export async function removeItem(itemId: string) {
  await requirePerm('업종 템플릿');
  if (!isUuid(itemId)) return;
  const db = await getDb();
  await db.delete(t.industryItems).where(eq(t.industryItems.id, itemId));
  done();
}

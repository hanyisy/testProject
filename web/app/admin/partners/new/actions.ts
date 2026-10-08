'use server';
/* 파트너 추가 4단계 — 아이디 중복 확인 · 계정 만들기 */
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePerm } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { isUuid, loginIdTaken, regionTakenBy } from '@/lib/partners';
import { BLOG_MODES, PAY_MODES } from '@/lib/constants';
import type { Features } from '@/db/schema';

const ID_RE = /^[a-z0-9][a-z0-9._]{2,29}$/;

export async function checkLoginId(id: string): Promise<'ok' | 'taken' | 'invalid'> {
  await requirePerm('파트너 관리');
  if (!ID_RE.test(id)) return 'invalid';
  return (await loginIdTaken(id)) ? 'taken' : 'ok';
}

export type NewPartner = {
  name: string; ceo: string; reg: string; tel: string; mgr: string; mobile: string; email: string;
  id: string; pw: string; industry: string; regions: string[]; plan: string; pay: string; drive: boolean;
  features: Features; leadId?: string;
};

export async function createPartner(p: NewPartner): Promise<{ ok: true; partnerId: string } | { ok: false; error: string }> {
  const u = await requirePerm('파트너 관리');
  if (!p.name.trim() || !p.mgr.trim() || !p.mobile.trim()) return { ok: false, error: '업체 정보를 확인해 주세요' };
  if (!ID_RE.test(p.id) || (await loginIdTaken(p.id))) return { ok: false, error: '아이디를 다시 확인해 주세요' };
  if (p.pw.length < 8) return { ok: false, error: '임시 비밀번호는 8자 이상이에요' };
  if (!PAY_MODES.includes(p.pay as never) || !BLOG_MODES.includes(p.features.blog)) return { ok: false, error: '설정을 확인해 주세요' };
  const db = await getDb();
  const [ind] = await db.select().from(t.industries).where(eq(t.industries.name, p.industry)).limit(1);
  const [plan] = await db.select().from(t.plans).where(eq(t.plans.name, p.plan)).limit(1);
  if (!ind || ind.status !== '사용 가능' || !plan) return { ok: false, error: '업종이나 요금제를 확인해 주세요' };
  const regions: string[] = [];
  for (const r of p.regions) if (!(await regionTakenBy(ind.name, r))) regions.push(r);
  if (!regions.length) return { ok: false, error: '서비스 지역을 하나 이상 골라 주세요' };

  const [partner] = await db.insert(t.partners).values({
    slug: p.id, name: p.name.trim(), ceo: p.ceo.trim() || null, bizRegNo: p.reg.trim() || null, tel: p.tel.trim() || null,
    manager: p.mgr.trim(), mobile: p.mobile.trim(), email: p.email.trim() || null,
    industryId: ind.id, planId: plan.id, status: '준비 중', payMode: p.pay as '계좌 입금', mark: p.name.trim().slice(0, 1),
    driveConnected: p.drive, createdBy: u.id
  }).returning();
  await db.insert(t.partnerRegions).values(regions.map((region, i) => ({ partnerId: partner.id, region, sort: i })));
  await db.insert(t.partnerFeatures).values({ partnerId: partner.id, ...p.features });
  await db.insert(t.scopeLogs).values({ partnerId: partner.id, userId: u.id, who: `${u.role} ${u.name}`, what: '최초 설정 · 기본', warningAck: '해당 없음' });
  await db.insert(t.users).values({
    loginId: p.id, passwordHash: await hashPassword(p.pw), kind: 'partner', partnerId: partner.id,
    name: p.mgr.trim(), phone: p.mobile.trim(), email: p.email.trim() || null, status: '첫 로그인 전', mustChangePassword: true, createdBy: u.id
  });
  if (p.leadId && isUuid(p.leadId)) await db.update(t.leads).set({ status: '계약', partnerId: partner.id }).where(eq(t.leads.id, p.leadId));
  await db.insert(t.auditLogs).values({ userId: u.id, action: '파트너 추가', targetType: 'partner', targetId: partner.id, detail: { name: partner.name, loginId: p.id } });
  revalidatePath('/admin', 'layout');
  return { ok: true, partnerId: partner.id };
}

export async function sendGuideSms(partnerId: string) {
  const u = await requirePerm('파트너 관리');
  const db = await getDb();
  await db.insert(t.auditLogs).values({ userId: u.id, action: '계정 안내 문자 발송(데모)', targetType: 'partner', targetId: partnerId });
}

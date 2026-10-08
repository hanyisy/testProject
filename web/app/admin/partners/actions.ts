'use server';
/* 파트너 상세: 업체 정보 · 서비스 지역 · 기능 스위치 · 다국어 · 양산 범위 · 도메인 · 결제 방식 · 임시 비밀번호 */
import { revalidatePath } from 'next/cache';
import { and, eq, ne } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePerm, type SessionUser } from '@/lib/auth';
import { BLOG_MODES, COUNTRIES, DOMESTIC, LANGS, ML_SCOPE, PAY_MODES, REGISTRARS, TIERS } from '@/lib/constants';
import { hashPassword, tempPassword } from '@/lib/password';
import { isUuid, regionTakenBy } from '@/lib/partners';

const who = (u: SessionUser) => `${u.role} ${u.name}`;
async function audit(u: SessionUser, action: string, partnerId: string, detail: object = {}) {
  const db = await getDb();
  await db.insert(t.auditLogs).values({ userId: u.id, action, targetType: 'partner', targetId: partnerId, detail });
}
const done = (id: string) => revalidatePath(`/admin/partners/${id}`, 'layout');

export async function saveInfo(fd: FormData) {
  const u = await requirePerm('파트너 관리');
  const id = fd.get('id');
  if (!isUuid(id)) return;
  const name = String(fd.get('name') ?? '').trim();
  if (!name) return;
  const db = await getDb();
  await db.update(t.partners).set({ name, tel: String(fd.get('tel') ?? '').trim(), email: String(fd.get('email') ?? '').trim() }).where(eq(t.partners.id, id));
  await audit(u, '업체 정보 수정', id);
  done(id);
}

export type RegionState = { error?: string };
export async function addRegion(_: RegionState, fd: FormData): Promise<RegionState> {
  const u = await requirePerm('파트너 관리');
  const id = fd.get('id');
  const region = String(fd.get('region') ?? '').trim().replace(/\s+/g, ' ');
  if (!isUuid(id) || !region) return {};
  const db = await getDb();
  const [p] = await db.select({ industry: t.industries.name }).from(t.partners).innerJoin(t.industries, eq(t.industries.id, t.partners.industryId)).where(eq(t.partners.id, id)).limit(1);
  const taken = await regionTakenBy(p.industry, region, id);
  if (taken) return { error: `이 지역은 같은 업종(${p.industry})을 ${taken}에서 운영 중이에요` };
  const existing = await db.select().from(t.partnerRegions).where(eq(t.partnerRegions.partnerId, id));
  if (existing.some((r) => r.region === region)) return { error: '이미 추가된 지역이에요' };
  await db.insert(t.partnerRegions).values({ partnerId: id, region, sort: existing.length });
  await audit(u, '서비스 지역 추가', id, { region });
  done(id);
  return {};
}

export async function removeRegion(fd: FormData) {
  const u = await requirePerm('파트너 관리');
  const id = fd.get('id'), region = String(fd.get('region') ?? '');
  if (!isUuid(id) || !region) return;
  const db = await getDb();
  await db.delete(t.partnerRegions).where(and(eq(t.partnerRegions.partnerId, id), eq(t.partnerRegions.region, region)));
  await audit(u, '서비스 지역 삭제', id, { region });
  done(id);
}

/** 기능 스위치 한 개 — 켜고 끄기 또는 블로그 방식 */
export async function setFeature(fd: FormData) {
  const u = await requirePerm('파트너 관리');
  const id = fd.get('id'), key = String(fd.get('key')), value = String(fd.get('value'));
  if (!isUuid(id)) return;
  const db = await getDb();
  if (key === 'blog') {
    if (!BLOG_MODES.includes(value as never)) return;
    await db.update(t.partnerFeatures).set({ blog: value as '꺼짐' }).where(eq(t.partnerFeatures.partnerId, id));
    /* 아직 안 올린 글은 새 방식으로 맞춤 (파트너 블로그 화면 · 본사 대행 목록이 같은 방식을 보게) */
    if (value === '직접 올리기' || value === '본사 대행') await db.update(t.blogPosts).set({ mode: value }).where(and(eq(t.blogPosts.partnerId, id), ne(t.blogPosts.status, '올림')));
  } else if (['alim', 'place', 'ml', 'sheet'].includes(key)) {
    await db.update(t.partnerFeatures).set({ [key]: value === 'on' }).where(eq(t.partnerFeatures.partnerId, id));
  } else return;
  await audit(u, '기능 스위치 변경', id, { key, value });
  done(id);
}

/** 다국어 설정: 언어 · 언어별 대상 국가 · 번역할 지역 · 번역 범위 */
export async function setMl(fd: FormData) {
  await requirePerm('파트너 관리');
  const id = fd.get('id'), op = String(fd.get('op')), v = String(fd.get('v') ?? ''), lang = String(fd.get('lang') ?? '');
  if (!isUuid(id)) return;
  const db = await getDb();
  const [f] = await db.select().from(t.partnerFeatures).where(eq(t.partnerFeatures.partnerId, id)).limit(1);
  const ml = f.mlConfig ?? { langs: [], countries: {}, regions: [], scope: '지역 + 가이드' };
  const toggle = (arr: string[], x: string) => (arr.includes(x) ? arr.filter((y) => y !== x) : [...arr, x]);
  if (op === 'lang' && LANGS.includes(v as never)) {
    ml.langs = toggle(ml.langs, v);
    ml.countries[v] ??= [DOMESTIC];
  } else if (op === 'country' && COUNTRIES[lang]) {
    const cur = ml.countries[lang] ?? [DOMESTIC];
    let next: string[];
    if (v === DOMESTIC) next = [DOMESTIC];
    else { next = toggle(cur.filter((x) => x !== DOMESTIC), v); if (!next.length) next = [DOMESTIC]; }
    ml.countries[lang] = next;
  } else if (op === 'region') ml.regions = toggle(ml.regions, v);
  else if (op === 'scope' && ML_SCOPE[v]) ml.scope = v;
  else return;
  await db.update(t.partnerFeatures).set({ mlConfig: ml }).where(eq(t.partnerFeatures.partnerId, id));
  done(id);
}

/** 양산 범위 — 기본으로 내릴 때는 바로, 확장·최대는 경고 확인 체크가 있어야 (기획서 4장: 선택 기록) */
export async function setScope(fd: FormData) {
  const u = await requirePerm('양산 범위 변경');
  const id = fd.get('id'), to = String(fd.get('scope'));
  if (!isUuid(id) || !TIERS.some((x) => x.name === to)) return;
  const ack = fd.get('ack') === 'on';
  if (to !== '기본' && !ack) return;
  const db = await getDb();
  const [p] = await db.select({ scope: t.partners.scope }).from(t.partners).where(eq(t.partners.id, id)).limit(1);
  if (p.scope === to) return;
  await db.update(t.partners).set({ scope: to as '기본' }).where(eq(t.partners.id, id));
  await db.insert(t.scopeLogs).values({
    partnerId: id, userId: u.id, who: who(u),
    what: to === '기본' ? `${p.scope} → 기본으로 변경` : `${p.scope} → ${to} 선택`,
    warningAck: to === '기본' ? '해당 없음' : '확인함'
  });
  done(id);
}

/** 도메인 저장 · 연결 확인 (컨펌 단계: 확인을 누르면 연결 → 인증서 발급 순서로 바뀌는 데모) */
export async function saveDomain(fd: FormData) {
  const u = await requirePerm('파트너 관리');
  const id = fd.get('id');
  const domain = String(fd.get('domain') ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!isUuid(id) || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return;
  const db = await getDb();
  const [cur] = await db.select().from(t.domains).where(eq(t.domains.partnerId, id)).limit(1);
  const values = { domain, connection: '확인 중' as const, certificate: '대기' as const, checkedAt: new Date() };
  if (cur) await db.update(t.domains).set(values).where(eq(t.domains.partnerId, id));
  else await db.insert(t.domains).values({ partnerId: id, ...values, verifyToken: Math.random().toString(16).slice(2, 10) });
  await audit(u, '도메인 연결 확인', id, { domain });
  done(id);
}

export async function setRegistrar(fd: FormData) {
  await requirePerm('파트너 관리');
  const id = fd.get('id'), v = String(fd.get('registrar'));
  if (!isUuid(id) || !REGISTRARS[v]) return;
  const db = await getDb();
  await db.update(t.domains).set({ registrar: v }).where(eq(t.domains.partnerId, id));
  done(id);
}

export async function setPayMode(fd: FormData) {
  const u = await requirePerm('양산 범위 변경');
  const id = fd.get('id'), v = String(fd.get('mode'));
  if (!isUuid(id) || !PAY_MODES.includes(v as never)) return;
  const db = await getDb();
  await db.update(t.partners).set({ payMode: v as '둘 다' }).where(eq(t.partners.id, id));
  await audit(u, '결제 방식 변경', id, { mode: v });
  done(id);
}

/** 임시 비밀번호 다시 만들기 — 기존 비밀번호는 바로 막히고, 새 값은 이 응답에서 한 번만 보여 줌 */
export type ReissueState = { pw?: string; sent?: boolean };
export async function reissuePassword(prev: ReissueState, fd: FormData): Promise<ReissueState> {
  const u = await requirePerm('양산 범위 변경');
  const id = fd.get('id');
  if (!isUuid(id)) return prev;
  if (fd.get('op') === 'sms') {
    await audit(u, '임시 비밀번호 문자 발송(데모)', id);
    return { ...prev, sent: true };
  }
  const pw = tempPassword();
  const db = await getDb();
  await db.update(t.users).set({ passwordHash: await hashPassword(pw), mustChangePassword: true })
    .where(and(eq(t.users.partnerId, id), eq(t.users.kind, 'partner')));
  /* 기존 세션도 끊음 */
  const [acct] = await db.select({ id: t.users.id }).from(t.users).where(and(eq(t.users.partnerId, id), eq(t.users.kind, 'partner'))).limit(1);
  if (acct) await db.delete(t.sessions).where(eq(t.sessions.userId, acct.id));
  await audit(u, '임시 비밀번호 재발급', id);
  return { pw };
}

/** 파트너 요청(기능 · 지역 추가 문의) 처리 완료 */
export async function resolveRequest(fd: FormData) {
  const u = await requirePerm('파트너 관리');
  const id = String(fd.get('id')), partnerId = String(fd.get('partnerId'));
  if (!isUuid(id) || !isUuid(partnerId)) return;
  const db = await getDb();
  await db.update(t.partnerRequests).set({ status: '처리 완료' }).where(and(eq(t.partnerRequests.id, id), eq(t.partnerRequests.partnerId, partnerId)));
  await audit(u, '파트너 요청 처리', partnerId, { request: id });
  revalidatePath('/admin', 'layout');
}

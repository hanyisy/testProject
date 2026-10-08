/* 본사 어드민 조회 — 화면에 필요한 값을 DB에서 계산 */
import 'server-only';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import type { ChipKind } from './format';

const n = sql<number>`count(*)::int`;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = await getDb();
  const [row] = await db.select().from(t.settings).where(eq(t.settings.key, key)).limit(1);
  return (row?.value as T) ?? fallback;
}

export type DemoStats = {
  partners: Record<string, { pages: number; indexed: number; requested: number; inquiries: number }>;
  monthPublished: Record<string, number>; monthInquiries: number; notMine: number;
  indexRatio: { pct: number; indexed: number; total: number };
  attention: { partner: string; tag: string; desc: string; value: string; to: 'indexing' | 'partner' }[];
};

/* ---------- 사이드바 숫자 · 처리할 일 ---------- */
export async function workCounts() {
  const db = await getDb();
  const [[leadNew], [dep], [tax], [agency], [fail], review] = await Promise.all([
    db.select({ n }).from(t.leads).where(eq(t.leads.status, '신규')),
    db.select({ n, sum: sql<number>`coalesce(sum(${t.charges.amount}),0)::int` }).from(t.charges).where(eq(t.charges.state, '입금 대기')),
    db.select({ n }).from(t.taxRequests).where(eq(t.taxRequests.state, '요청됨')),
    db.select({ n }).from(t.blogPosts).where(and(eq(t.blogPosts.mode, '본사 대행'), eq(t.blogPosts.status, '승인'))),
    db.select({ n }).from(t.jobs).where(eq(t.jobs.status, '실패')),
    db.select({ type: t.reviewBundles.type, state: t.reviewItems.state, bundle: t.reviewBundles.id, kind: t.reviewBundles.kind, partner: t.partners.name, n })
      .from(t.reviewItems).innerJoin(t.reviewBundles, eq(t.reviewBundles.id, t.reviewItems.bundleId))
      .innerJoin(t.partners, eq(t.partners.id, t.reviewBundles.partnerId))
      .where(inArray(t.reviewItems.state, ['대기', '발행 중 · 수정 대기', '개별 검수']))
      .groupBy(t.reviewBundles.type, t.reviewItems.state, t.reviewBundles.id, t.reviewBundles.kind, t.partners.name)
  ]);
  const pagesPending = review.filter((r) => r.type !== '번역').reduce((a, r) => a + r.n, 0);
  const individual = review.filter((r) => r.state === '개별 검수').reduce((a, r) => a + r.n, 0);
  const bundles = new Set(review.filter((r) => r.type !== '번역' && r.state !== '개별 검수').map((r) => r.bundle)).size;
  const tr = review.filter((r) => r.type === '번역');
  const translations = tr.reduce((a, r) => a + r.n, 0);
  /* 처리할 일 보조 문구: 맑은집클린 · 영어·중국어 */
  const uniq = (xs: string[]) => Array.from(new Set(xs));
  const translationSub = [uniq(tr.map((r) => r.partner)).join('·'), uniq(tr.map((r) => r.kind.replace(/\s*번역$/, '').replace(/\(.*\)/, ''))).join('·')].filter(Boolean).join(' · ');
  return {
    leadNew: leadNew.n, deposits: dep.n, depositSum: dep.sum, taxes: tax.n, agency: agency.n, fails: fail.n,
    pagesPending, individual, bundles, translations, translationSub,
    nav: { leads: leadNew.n, review: pagesPending + translations, jobs: fail.n, money: dep.n + tax.n, agency: agency.n }
  };
}

/* ---------- 대시보드 ---------- */
export async function dashboard() {
  const db = await getDb();
  const [counts, stats, partnerRows] = await Promise.all([
    workCounts(),
    getSetting<DemoStats | null>('demo_stats', null),
    db.select({ status: t.partners.status, n }).from(t.partners).groupBy(t.partners.status)
  ]);
  const by = Object.fromEntries(partnerRows.map((r) => [r.status, r.n])) as Record<string, number>;
  const agencyPartners = await db.selectDistinct({ name: t.partners.name }).from(t.blogPosts)
    .innerJoin(t.partners, eq(t.partners.id, t.blogPosts.partnerId))
    .where(and(eq(t.blogPosts.mode, '본사 대행'), eq(t.blogPosts.status, '승인')));
  const reqs = await db.select({ id: t.partners.id, name: t.partners.name }).from(t.partnerRequests).innerJoin(t.partners, eq(t.partners.id, t.partnerRequests.partnerId)).where(eq(t.partnerRequests.status, '접수'));
  const reqNames = Array.from(new Set(reqs.map((r) => r.name)));
  const won = (v: number) => v.toLocaleString('ko-KR');
  const published = stats ? Object.values(stats.monthPublished).reduce((a, b) => a + b, 0) : 0;
  return {
    stats: [
      { label: '활성 파트너', num: by['운영 중'] ?? 0, unit: '곳', note: `준비 중 ${by['준비 중'] ?? 0} · 종료 ${by['종료'] ?? 0}` },
      { label: '이번 달 발행 페이지', num: published, unit: '장', note: stats ? Object.entries(stats.monthPublished).map(([k, v]) => `${k} ${v}`).join(' · ') : '' },
      { label: '색인 확인 비율', num: stats?.indexRatio.pct ?? 0, unit: '%', note: stats ? `운영 중 파트너 ${stats.indexRatio.total}장 중 ${stats.indexRatio.indexed}장` : '' },
      { label: '이번 달 문의', num: stats?.monthInquiries ?? 0, unit: '건', note: stats ? `본인 아님 ${stats.notMine}건 제외` : '' }
    ],
    todos: [
      { perm: '파트너 관리' as const, label: '신규 가입 문의', n: counts.leadNew, sub: '랜딩 가입 문의 폼', href: '/admin/leads?tab=신규' },
      { perm: '입금 확인 · 세금계산서' as const, label: '입금 확인 대기', n: counts.deposits, sub: won(counts.depositSum) + '원', href: '/admin/billing' },
      { perm: '입금 확인 · 세금계산서' as const, label: '세금계산서 발행 요청', n: counts.taxes, sub: '계좌 입금 건', href: '/admin/billing' },
      { perm: '대행 작업' as const, label: '블로그 대행 대기', n: counts.agency, sub: agencyPartners.map((p) => p.name).join(' · '), href: '/admin/agency' },
      { perm: '파트너 관리' as const, optional: true, label: '파트너 요청', n: reqs.length, sub: reqNames.join(' · ') || '기능 · 지역 추가 문의', href: reqNames.length === 1 ? `/admin/partners/${reqs[0].id}` : '/admin/partners' },
      { perm: '검수' as const, label: '페이지 검수 대기', n: counts.pagesPending, sub: `묶음 ${counts.bundles} · 개별 ${counts.individual}`, href: '/admin/review' },
      { perm: '검수' as const, label: '번역 검수 대기', n: counts.translations, sub: counts.translationSub, href: '/admin/review' },
      { perm: '작업 로그' as const, label: '실패한 작업', n: counts.fails, sub: '오늘', href: '/admin/jobs', alert: true }
    ],
    attention: stats?.attention ?? []
  };
}

/* ---------- 가입 문의 ---------- */
export const LEAD_STATUSES = ['신규', '연락함', '상담 중', '계약', '보류'] as const;
export const LEAD_STATUS_CHIP: Record<string, ChipKind> = { '신규': 'info', '연락함': 'gray', '상담 중': 'warn', '계약': 'ok', '보류': 'red' };

/** 업종×지역 점유: { 업종 이름: { 지역: "한결철거" | "온마루 · 준비 중" } } — 종료 파트너는 빠짐 */
export async function occupancy() {
  const db = await getDb();
  const rows = await db.select({ industry: t.industries.name, region: t.partnerRegions.region, partner: t.partners.name, status: t.partners.status })
    .from(t.partnerRegions)
    .innerJoin(t.partners, eq(t.partners.id, t.partnerRegions.partnerId))
    .innerJoin(t.industries, eq(t.industries.id, t.partners.industryId))
    .where(ne(t.partners.status, '종료'))
    .orderBy(asc(t.partnerRegions.sort));
  const occ: Record<string, Record<string, string>> = {};
  for (const r of rows) (occ[r.industry] ??= {})[r.region] = r.status === '준비 중' ? `${r.partner} · 준비 중` : r.partner;
  return occ;
}

/** 신청 가능 칩: 계약 → 등록됨 · 점유된 지역이 하나라도 있으면 점유됨 · 대기 · 아니면 가능 */
export function availability(lead: { status: string; industry: string; regions: string[] }, occ: Record<string, Record<string, string>>): [string, ChipKind] {
  if (lead.status === '계약') return ['등록됨', 'gray'];
  return lead.regions.some((r) => occ[lead.industry]?.[r]) ? ['점유됨 · 대기', 'warn'] : ['가능', 'ok'];
}

export async function leadList() {
  const db = await getDb();
  const [rows, occ] = await Promise.all([
    db.select({ lead: t.leads, owner: t.users.name }).from(t.leads).leftJoin(t.users, eq(t.users.id, t.leads.ownerUserId)).orderBy(desc(t.leads.receivedAt)),
    occupancy()
  ]);
  return rows.map(({ lead, owner }) => ({ ...lead, owner: owner ?? '', av: availability(lead, occ) }));
}

export async function leadDetail(id: string) {
  const db = await getDb();
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [row] = await db.select({ lead: t.leads, owner: t.users.name }).from(t.leads).leftJoin(t.users, eq(t.users.id, t.leads.ownerUserId)).where(eq(t.leads.id, id)).limit(1);
  if (!row) return null;
  const [memos, occ, templates, staff] = await Promise.all([
    db.select({ memo: t.leadMemos, who: t.users.name }).from(t.leadMemos).leftJoin(t.users, eq(t.users.id, t.leadMemos.userId))
      .where(eq(t.leadMemos.leadId, id)).orderBy(desc(t.leadMemos.createdAt)),
    occupancy(),
    db.select({ name: t.industries.name }).from(t.industries).where(eq(t.industries.status, '사용 가능')),
    db.select({ id: t.users.id, name: t.users.name }).from(t.users).where(and(eq(t.users.kind, 'staff'), ne(t.users.status, '사용 중지'))).orderBy(asc(t.users.createdAt))
  ]);
  const lead = row.lead;
  const av = availability(lead, occ);
  const noTemplate = !templates.some((x) => x.name === lead.industry);
  const regionsHere = Array.from(new Set([...lead.regions, ...Object.keys(occ[lead.industry] ?? {})]));
  const canRegister = lead.status !== '계약' && av[0] === '가능' && !noTemplate;
  const reason = lead.status === '계약' ? '이미 파트너로 등록된 문의예요'
    : av[0] !== '가능' ? '같은 업종이 이 지역을 이미 운영 중이라 등록할 수 없어요 · 대기 목록에 둬요'
      : '업종 템플릿이 없어서 아직 등록할 수 없어요';
  return {
    lead, owner: row.owner ?? '', av, noTemplate, canRegister, reason, staff,
    memos: memos.map((m) => ({ id: m.memo.id, body: m.memo.body, at: m.memo.createdAt, who: m.who ?? '' })),
    occ: regionsHere.map((region) => {
      const who = occ[lead.industry]?.[region];
      const mine = lead.regions.includes(region);
      return { region, mine, label: who ?? '비어 있음', kind: (who ? (lead.status === '계약' && mine ? 'gray' : 'warn') : 'ok') as ChipKind };
    })
  };
}

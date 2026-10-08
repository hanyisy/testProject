/* 페이지 생성 계산 · 흐름 — 서버 전용 모듈(server-only) 없이: 어드민 화면과 데모 시드(db:reset)가 같이 씀 */
import { and, asc, eq } from 'drizzle-orm';
import { schema as t, type DB } from '@/db/client';
import { copula, fill, termsOf } from './text';
import type { IndustryContent } from './site';

export type DraftStyle = { label: string; style: string; desc: string; body: string[] };
export type RegionStat = { photos: number; sites: number; info: string | null };

export const kindOf = (type: string, work: string) => (type === '지역×작업' ? `지역×${work}` : `${type}×${work}`);
/** 지역×상가철거 → 상가 철거 (본문 {작업} 칸) */
export const workPhrase = (work: string, industry: string) => { const ind = industry.replace(/\s/g, ''); return work.endsWith(ind) && work !== ind ? `${work.slice(0, -ind.length)} ${industry}` : work; };

/** 기본 배분: 사진 많은 지역부터 고른 시안을 돌아가며 — 시안마다 사진 많은/적은 지역이 고르게 섞임 */
export function autoAssign(regions: { name: string; photos: number }[], picked: string[]) {
  const order = [...regions].sort((a, b) => b.photos - a.photos);
  return Object.fromEntries(order.map((r, i) => [r.name, picked[i % picked.length]]));
}

/** 고유 내용 비율: 페이지 글자 중 이 페이지에만 있는 부분의 비율
 * = 본문 칸(지역명 · 지역 정보 · 숫자) + 현장마다 붙는 현장 기록 한 줄 + 사진마다 붙는 설명 */
const SITE_TEXT = 40, PHOTO_TEXT = 4;
export function uniquePct(body: string[], v: { name: string; info: string | null; sites: number; photos: number }) {
  const strip = (s: string) => s.replace(/\s/g, '').length;
  const map: Record<string, string> = { '지역명': v.name, '지역 정보': v.info ?? '', '현장 수': String(v.sites), '사진 수': String(v.photos) };
  let uniq = 0, total = 0;
  for (const p of body) {
    for (const part of p.split(/(\{[^}]+\})/)) {
      const m = part.match(/^\{(.+)\}$/);
      const n = strip(m ? map[m[1]] ?? '' : part);
      total += n;
      if (m) uniq += n;
    }
  }
  const extra = v.sites * SITE_TEXT + v.photos * PHOTO_TEXT;
  return total + extra ? Math.round(((uniq + extra) / (total + extra)) * 100) : 0;
}

/* ---------- 생성 흐름 (어드민 화면 · 데모 시드가 같이 씀 — db를 받아서, 서버 전용 모듈 없이) ---------- */

const setting = async <T,>(db: DB, key: string, fallback: T): Promise<T> => {
  const [row] = await db.select().from(t.settings).where(eq(t.settings.key, key)).limit(1);
  return (row?.value as T) ?? fallback;
};

export async function runStateWith(db: DB, runId: string) {
  const [run] = await db.select().from(t.generationRuns).where(eq(t.generationRuns.id, runId)).limit(1);
  if (!run) return null;
  const [drafts, assigns, styles, stats] = await Promise.all([
    db.select().from(t.generationDrafts).where(eq(t.generationDrafts.runId, runId)).orderBy(asc(t.generationDrafts.label)),
    db.select().from(t.generationAssignments).where(eq(t.generationAssignments.runId, runId)),
    setting<DraftStyle[]>(db, 'draft_styles', []),
    setting<Record<string, RegionStat>>(db, 'region_stats', {})
  ]);
  const regions = run.regions.map((name) => {
    const key = name.split(' ').slice(-2).join(' ');
    const s = stats[key] ?? stats[name] ?? { photos: 0, sites: 0, info: null };
    return { name: key, ...s };
  });
  return { run, drafts, assigns, styles, regions };
}

/** 생성 시작: 생성 기록 + 시안 n개 */
export async function createRun(db: DB, input: { partnerId: string; type: string; work: string; regions: string[]; draftCount: number; createdBy?: string | null; status?: '생성 중' | '완료' }) {
  const n = Math.min(6, Math.max(3, Math.round(input.draftCount)));
  const styles = await setting<DraftStyle[]>(db, 'draft_styles', []);
  const [run] = await db.insert(t.generationRuns).values({
    partnerId: input.partnerId, pageType: kindOf(input.type, input.work), work: input.work, regions: input.regions, draftCount: n, status: input.status ?? '생성 중', createdBy: input.createdBy ?? null
  }).returning();
  await db.insert(t.generationDrafts).values(styles.slice(0, n).map((s) => ({ runId: run.id, label: s.label, style: s.style, description: s.desc })));
  return run;
}

/** 시안 고르기 + 기본 배분 (데모 시드용 — 화면에서는 고르기 · 배분을 따로 함) */
export async function pickAndAssign(db: DB, runId: string, labels: string[]) {
  for (const label of labels) await db.update(t.generationDrafts).set({ picked: true }).where(and(eq(t.generationDrafts.runId, runId), eq(t.generationDrafts.label, label)));
  const st = await runStateWith(db, runId);
  if (!st) return;
  const auto = autoAssign(st.regions, labels);
  await db.insert(t.generationAssignments).values(st.regions.map((r) => ({ runId, region: st.run.regions.find((x) => x.endsWith(r.name)) ?? r.name, draftLabel: auto[r.name] })));
  await db.update(t.generationRuns).set({ status: '배분 확인' }).where(eq(t.generationRuns.id, runId));
}

/** 배분 확인 → 검수 묶음 · 공개 페이지 행 만들기 (페이지는 검수 중 = 미리보기만) */
export async function buildReview(db: DB, runId: string, opts: { createdOn: string }) {
  const st = await runStateWith(db, runId);
  if (!st) return { ok: false as const, error: '생성 기록을 찾을 수 없어요' };
  if (st.run.status === '검수로 넘김') return { ok: true as const };
  const [[p], minPhotos, minUnique, contents] = await Promise.all([
    db.select({ name: t.partners.name, industry: t.industries.name, code: t.industries.code }).from(t.partners).innerJoin(t.industries, eq(t.industries.id, t.partners.industryId)).where(eq(t.partners.id, st.run.partnerId)).limit(1),
    setting<number>(db, 'review_min_photos', 3), setting<number>(db, 'review_min_unique', 35),
    setting<Record<string, IndustryContent>>(db, 'industry_content', {})
  ]);
  const picked = st.drafts.filter((d) => d.picked);
  const labelOf = (name: string) => st.assigns.find((a) => a.region.endsWith(name))?.draftLabel ?? picked[0]?.label;
  const work = workPhrase(st.run.work, p.industry);
  /* 업종 문장은 업종 내용에서 — 시안 본문이 어느 업종에도 맞게 · 조사는 {업체|이}처럼 받침에 맞춰 */
  const ic = contents[p.code];
  const period = ic?.cost.summary.find((x) => x.k === '기간');
  const vals: Record<string, string> = {
    업체: p.name, 작업: work, '작업 방식': ic?.method ?? '', 현장: termsOf(ic?.terms).case, '문의 방법': termsOf(ic?.terms).ask,
    '기간 안내': period ? `작업 기간은 보통 ${copula(period.v)}${period.note ? `(${period.note})` : ''}. 아래 표에서 ${ic!.cost.table.head[0]}별로 확인해 보세요.` : ''
  };
  for (const d of picked) {
    const style = st.styles.find((s) => s.label === d.label);
    const body = (style?.body ?? []).map((x) => fill(x, vals)).filter((x) => x.trim());
    const regs = st.regions.filter((r) => labelOf(r.name) === d.label);
    if (!regs.length) continue;
    const [b] = await db.insert(t.reviewBundles).values({
      partnerId: st.run.partnerId, kind: `${st.run.pageType} · 시안 ${d.label}`, type: '지역', draftStyle: d.style, col1: '지역명', col2: '지역 정보 요약', commonBody: body, createdOn: opts.createdOn
    }).returning();
    const made = await db.insert(t.reviewItems).values(regs.map((r, i) => {
      const uniq = uniquePct(body, r);
      const reasons = [...(r.photos < minPhotos ? ['사진 부족'] : []), ...(uniq < minUnique ? ['고유 내용 부족'] : [])];
      return {
        bundleId: b.id, name: r.name, info: reasons.length ? '' : r.info ?? '', photos: r.photos, sites: r.sites, uniquePct: uniq, sort: i,
        state: (reasons.length ? '개별 검수' : '대기') as '대기', reasons,
        note: reasons.length ? [r.sites ? `현장 ${r.sites}곳` : '현장 없음', `사진 ${r.photos}장`, reasons.includes('사진 부족') ? '사진을 더 올리면 묶음으로 돌아가요' : '지역 정보를 더 채우면 묶음으로 돌아가요'].join(' · ') : null
      };
    })).returning();
    /* 공개 페이지 행: 검수 중(미리보기만) → 검수 완료되면 발행 · 주소 /p/{slug}/{시}/{동}-{작업} */
    for (const it of made) {
      const [city, dong] = it.name.split(' ');
      const [pg] = await db.insert(t.pages).values({
        partnerId: st.run.partnerId, type: '지역', title: `${it.name} ${work}`, path: `${city}/${dong}-${st.run.work}`, runId,
        regionKey: it.name, work: st.run.work, draftLabel: d.label, status: it.state === '개별 검수' ? '작성 중' : '검수 중'
      }).returning();
      await db.update(t.reviewItems).set({ pageId: pg.id }).where(eq(t.reviewItems.id, it.id));
    }
  }
  await db.update(t.generationRuns).set({ status: '검수로 넘김' }).where(eq(t.generationRuns.id, runId));
  return { ok: true as const };
}

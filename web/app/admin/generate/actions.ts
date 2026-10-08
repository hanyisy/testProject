'use server';
/* 페이지 생성 (3r–3x): 사진 올리기 · 드라이브 동기화 · 생성 시작/다시 생성 · 시안 선택 · 배분 · 검수 묶음 만들기 · 파트너 확인 요청 */
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requireStaff } from '@/lib/auth';
import { getSetting } from '@/lib/admin';
import { md } from '@/lib/format';
import { today } from '@/lib/config';
import { isUuid } from '@/lib/partners';
import { savePhoto } from '@/lib/photos';
import { autoAssign, kindOf, runState, uniquePct, workPhrase, type DraftStyle } from '@/lib/generate';
import { copula, fill, type IndustryContent } from '@/lib/site';

const done = () => revalidatePath('/admin/generate');

export async function adminUploadPhoto(partnerId: string, fd: FormData) {
  await requireStaff();
  if (!isUuid(partnerId)) return { ok: false as const, error: '파트너를 골라 주세요' };
  return savePhoto(partnerId, fd.get('file'), Number(fd.get('lastModified')));
}

/** 드라이브 동기화 (Drive API 연동 전 — 동기화 시각만) */
export async function syncPartnerDrive(partnerId: string) {
  await requireStaff();
  if (!isUuid(partnerId)) return;
  const db = await getDb();
  await new Promise((r) => setTimeout(r, 900));
  await db.update(t.partners).set({ driveSyncedAt: new Date() }).where(eq(t.partners.id, partnerId));
  done();
}

export async function startRun(input: { partnerId: string; type: string; work: string; regions: string[]; draftCount: number }) {
  const u = await requireStaff();
  if (!isUuid(input.partnerId) || !input.regions.length || !input.work) return { ok: false as const, error: '지역과 작업을 골라 주세요' };
  const n = Math.min(6, Math.max(3, Math.round(input.draftCount)));
  const styles = await getSetting<DraftStyle[]>('draft_styles', []);
  const db = await getDb();
  const [run] = await db.insert(t.generationRuns).values({
    partnerId: input.partnerId, pageType: kindOf(input.type, input.work), work: input.work, regions: input.regions, draftCount: n, status: '생성 중', createdBy: u.id
  }).returning();
  await db.insert(t.generationDrafts).values(styles.slice(0, n).map((s) => ({ runId: run.id, label: s.label, style: s.style, description: s.desc })));
  await db.insert(t.jobs).values({ partnerId: input.partnerId, kind: '빌드', status: '성공', reason: null });
  done();
  return { ok: true as const, runId: run.id };
}

export async function regenerate(runId: string) {
  await requireStaff();
  if (!isUuid(runId)) return;
  const db = await getDb();
  const [r] = await db.select().from(t.generationRuns).where(eq(t.generationRuns.id, runId)).limit(1);
  if (!r || r.status === '검수로 넘김') return;
  await db.update(t.generationRuns).set({ startedAt: new Date(), regenCount: r.regenCount + 1, status: '생성 중' }).where(eq(t.generationRuns.id, runId));
  await db.update(t.generationDrafts).set({ picked: false }).where(eq(t.generationDrafts.runId, runId));
  await db.delete(t.generationAssignments).where(eq(t.generationAssignments.runId, runId));
  done();
}

/** 생성 중 → 완료 (진행률이 다 차면 화면에서 부름) */
export async function markGenerated(runId: string) {
  await requireStaff();
  if (!isUuid(runId)) return;
  const db = await getDb();
  await db.update(t.generationRuns).set({ status: '완료' }).where(and(eq(t.generationRuns.id, runId), eq(t.generationRuns.status, '생성 중')));
}

export async function togglePick(runId: string, label: string) {
  await requireStaff();
  if (!isUuid(runId)) return;
  const db = await getDb();
  const [d] = await db.select().from(t.generationDrafts).where(and(eq(t.generationDrafts.runId, runId), eq(t.generationDrafts.label, label))).limit(1);
  if (!d) return;
  await db.update(t.generationDrafts).set({ picked: !d.picked }).where(and(eq(t.generationDrafts.runId, runId), eq(t.generationDrafts.label, label)));
  done();
}

/** 시안 선택 끝 → 지역별 배분 만들기 (이미 있으면 고른 시안 안에서만 유지) */
export async function toAssign(runId: string) {
  await requireStaff();
  const st = isUuid(runId) ? await runState(runId) : null;
  if (!st) return { ok: false as const, error: '생성 기록을 찾을 수 없어요' };
  const picked = st.drafts.filter((d) => d.picked).map((d) => d.label);
  if (picked.length < 2) return { ok: false as const, error: '시안을 2개 이상 골라 주세요' };
  const db = await getDb();
  const auto = autoAssign(st.regions, picked);
  for (const r of st.regions) {
    const full = st.run.regions.find((x) => x.endsWith(r.name)) ?? r.name;
    const cur = st.assigns.find((a) => a.region === full);
    const label = cur && picked.includes(cur.draftLabel) ? cur.draftLabel : auto[r.name];
    if (cur) await db.update(t.generationAssignments).set({ draftLabel: label }).where(and(eq(t.generationAssignments.runId, runId), eq(t.generationAssignments.region, full)));
    else await db.insert(t.generationAssignments).values({ runId, region: full, draftLabel: label });
  }
  if (st.run.status !== '검수로 넘김') await db.update(t.generationRuns).set({ status: '배분 확인' }).where(eq(t.generationRuns.id, runId));
  done();
  return { ok: true as const };
}

export async function cycleDraft(runId: string, region: string) {
  await requireStaff();
  const st = isUuid(runId) ? await runState(runId) : null;
  if (!st || st.run.status === '검수로 넘김') return;
  const picked = st.drafts.filter((d) => d.picked).map((d) => d.label);
  const cur = st.assigns.find((a) => a.region === region);
  if (!cur || !picked.length) return;
  const next = picked[(picked.indexOf(cur.draftLabel) + 1) % picked.length];
  const db = await getDb();
  await db.update(t.generationAssignments).set({ draftLabel: next, override: true }).where(and(eq(t.generationAssignments.runId, runId), eq(t.generationAssignments.region, region)));
  done();
}

export async function swapPhotos(runId: string, region: string) {
  await requireStaff();
  if (!isUuid(runId)) return;
  const db = await getDb();
  const [a] = await db.select().from(t.generationAssignments).where(and(eq(t.generationAssignments.runId, runId), eq(t.generationAssignments.region, region))).limit(1);
  if (!a) return;
  await db.update(t.generationAssignments).set({ photoSeed: a.photoSeed + 1 }).where(and(eq(t.generationAssignments.runId, runId), eq(t.generationAssignments.region, region)));
  done();
}

export async function autoRedistribute(runId: string) {
  await requireStaff();
  const st = isUuid(runId) ? await runState(runId) : null;
  if (!st || st.run.status === '검수로 넘김') return;
  const picked = st.drafts.filter((d) => d.picked).map((d) => d.label);
  const auto = autoAssign(st.regions, picked);
  const db = await getDb();
  for (const a of st.assigns) {
    const key = a.region.split(' ').slice(-2).join(' ');
    await db.update(t.generationAssignments).set({ draftLabel: auto[key] ?? picked[0], override: false, photoSeed: 0 })
      .where(and(eq(t.generationAssignments.runId, runId), eq(t.generationAssignments.region, a.region)));
  }
  done();
}

/** 배분 확인 끝 → 같은 시안끼리 검수 묶음 · 사진 부족 / 고유 내용 부족은 개별 검수로 */
export async function toReview(runId: string) {
  const u = await requireStaff();
  const st = isUuid(runId) ? await runState(runId) : null;
  if (!st) return { ok: false as const, error: '생성 기록을 찾을 수 없어요' };
  if (st.run.status === '검수로 넘김') return { ok: true as const };
  const db = await getDb();
  const [[p], minPhotos, minUnique, day, contents] = await Promise.all([
    db.select({ name: t.partners.name, industry: t.industries.name, code: t.industries.code }).from(t.partners).innerJoin(t.industries, eq(t.industries.id, t.partners.industryId)).where(eq(t.partners.id, st.run.partnerId)).limit(1),
    getSetting<number>('review_min_photos', 3), getSetting<number>('review_min_unique', 35), today(),
    getSetting<Record<string, IndustryContent>>('industry_content', {})
  ]);
  const picked = st.drafts.filter((d) => d.picked);
  const labelOf = (name: string) => st.assigns.find((a) => a.region.endsWith(name))?.draftLabel ?? picked[0]?.label;
  const work = workPhrase(st.run.work, p.industry);
  /* 업종 문장은 업종 내용에서 — 시안 본문이 어느 업종에도 맞게 · 조사는 {업체|이}처럼 받침에 맞춰 */
  const ic = contents[p.code];
  const period = ic?.cost.summary.find((x) => x.k === '기간');
  const vals: Record<string, string> = {
    업체: p.name, 작업: work, '작업 방식': ic?.method ?? '',
    '기간 안내': period ? `작업 기간은 보통 ${copula(period.v)}${period.note ? `(${period.note})` : ''}. 아래 표에서 ${ic!.cost.table.head[0]}별로 확인해 보세요.` : ''
  };
  for (const d of picked) {
    const style = st.styles.find((s) => s.label === d.label);
    const body = (style?.body ?? []).map((x) => fill(x, vals)).filter((x) => x.trim());
    const regs = st.regions.filter((r) => labelOf(r.name) === d.label);
    if (!regs.length) continue;
    const [b] = await db.insert(t.reviewBundles).values({
      partnerId: st.run.partnerId, kind: `${st.run.pageType} · 시안 ${d.label}`, type: '지역', draftStyle: d.style, col1: '지역명', col2: '지역 정보 요약', commonBody: body, createdOn: md(day)
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
        partnerId: st.run.partnerId, type: '지역', title: `${it.name} ${work}`, path: `${city}/${dong}-${st.run.work}`, runId, regionKey: it.name,
        work: st.run.work, draftLabel: d.label, status: it.state === '개별 검수' ? '작성 중' : '검수 중'
      }).returning();
      await db.update(t.reviewItems).set({ pageId: pg.id }).where(eq(t.reviewItems.id, it.id));
    }
  }
  await db.update(t.generationRuns).set({ status: '검수로 넘김' }).where(eq(t.generationRuns.id, runId));
  await db.insert(t.auditLogs).values({ userId: u.id, action: '페이지 생성 → 검수', targetType: 'generation', targetId: runId });
  revalidatePath('/admin', 'layout');
  return { ok: true as const };
}

export async function requestPreview(runId: string) {
  const u = await requireStaff();
  if (!isUuid(runId)) return;
  const db = await getDb();
  await db.update(t.generationRuns).set({ previewRequestedAt: new Date() }).where(eq(t.generationRuns.id, runId));
  await db.insert(t.auditLogs).values({ userId: u.id, action: '시안 미리보기 확인 요청', targetType: 'generation', targetId: runId });
  done();
}

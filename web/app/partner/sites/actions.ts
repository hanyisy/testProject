'use server';
/* 현장 발행 (2b): 사진 공개 확인 → 현장 정보(업종 템플릿 "현장 입력 항목") → 발행
 * 발행하면 현장과 "현장 기록" 페이지를 만듦. 같은 동의 지역 페이지 · 시 허브는 현장 목록으로 그려져 이 현장이 바로 들어감
 * 빌드 · 배포 · 색인 전송은 작업 어댑터(lib/adapters/jobs)로 돌리고 결과를 작업 로그(jobs)에 남김 */
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePartner } from '@/lib/auth';
import { LIVE } from '@/lib/site';
import { runJob } from '@/lib/adapters/jobs';
import { fieldKind } from './fields';

export type PublishInput = {
  photoIds: string[]; publicIds: string[]; city: string; dong: string; work: string; building: string;
  area: number | null; days: number | null; note: string; details: Record<string, string>;
};
export type NewPage = { kind: string; tag: '신규' | '보강' | '갱신'; title: string; status: string };
export type PublishResult = { ok: true; title: string; photos: number; pages: NewPage[] } | { ok: false; error: string };

export async function publishSite(input: PublishInput): Promise<PublishResult> {
  const user = await requirePartner();
  const db = await getDb();
  const photos = input.photoIds.length
    ? await db.select().from(t.photos).where(and(eq(t.photos.partnerId, user.partnerId), inArray(t.photos.id, input.photoIds), isNull(t.photos.siteId)))
    : [];
  if (!photos.length) return { ok: false, error: '이미 발행했거나 없는 사진이에요' };
  const pub = new Set(input.publicIds.filter((id) => photos.some((p) => p.id === id)));
  if (!pub.size) return { ok: false, error: '공개할 사진을 하나 이상 골라 주세요' };
  if (photos.some((p) => p.hasPerson && pub.has(p.id))) return { ok: false, error: '사람이 찍힌 사진을 비공개로 바꿔 주세요' };

  /* 위치: 업체 서비스 지역의 시 + 동 이름 (사진 위치로 동을 못 정하면 파트너가 적음) */
  const [[p], regions] = await Promise.all([
    db.select({ industryId: t.partners.industryId }).from(t.partners).where(eq(t.partners.id, user.partnerId)).limit(1),
    db.select({ region: t.partnerRegions.region }).from(t.partnerRegions).where(eq(t.partnerRegions.partnerId, user.partnerId))
  ]);
  const cities = regions.map((r) => r.region.split(' ').slice(-1)[0]);
  const city = input.city.trim(), dong = input.dong.trim().replace(/\s+/g, '');
  if (!cities.includes(city)) return { ok: false, error: '서비스 지역의 시를 골라 주세요' };
  if (!/^[가-힣0-9]{1,12}$/.test(dong)) return { ok: false, error: '동 이름을 적어 주세요 (예: 퇴계동)' };
  const place = `${city} ${dong}`;

  /* 현장 정보: 업종 템플릿의 "현장 입력 항목"에 있는 것만 받고, 평수 · 기간은 항목에 있을 때만 필수 */
  const items = await db.select().from(t.industryItems).where(eq(t.industryItems.industryId, p.industryId)).orderBy(asc(t.industryItems.sort));
  const works = items.filter((i) => i.group === '작업 종류').map((i) => i.label);
  const buildings = items.filter((i) => i.group === '대상 유형').map((i) => i.label);
  const fields = items.filter((i) => i.group === '현장 입력 항목').map((i) => i.label);
  if (!works.includes(input.work) || !buildings.includes(input.building)) return { ok: false, error: '작업 종류와 유형을 골라 주세요' };
  const needArea = fields.some((f) => fieldKind(f) === 'area'), needDays = fields.some((f) => fieldKind(f) === 'days');
  if (needArea && !(input.area && input.area > 0)) return { ok: false, error: '현장 정보를 모두 입력해 주세요' };
  if (needDays && !(input.days && input.days > 0)) return { ok: false, error: '현장 정보를 모두 입력해 주세요' };
  const details = Object.fromEntries(fields.filter((f) => fieldKind(f) === 'extra').map((f) => [f, String(input.details?.[f] ?? '').trim().slice(0, 60)]).filter(([, v]) => v));

  const title = `${place} ${input.building} ${input.work}`;
  const [site] = await db.insert(t.sites).values({
    partnerId: user.partnerId, title, region: place, workType: input.work, buildingType: input.building,
    areaPyeong: needArea ? Math.round(input.area!) : null, days: needDays ? Math.round(input.days!) : null, note: input.note.trim().slice(0, 200) || null, details,
    workedAt: photos[0].takenAt ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(photos[0].takenAt) : null,
    photoCount: pub.size, status: '발행됨', publishedAt: new Date()
  }).returning();
  for (const ph of photos) await db.update(t.photos).set({ siteId: site.id, partnerPublic: pub.has(ph.id), place }).where(eq(t.photos.id, ph.id));

  /* 이 현장으로 바뀌는 페이지 — 실제로 바뀌는 것만:
   *  현장 기록(새로) · 같은 동의 지역 페이지(현장 목록에 들어감) · 시 허브(현장 목록에 들어감) */
  await db.insert(t.pages).values({
    partnerId: user.partnerId, siteId: site.id, type: '현장', title, path: `현장/${site.id.slice(0, 8)}`, regionKey: place,
    work: `${input.building}${input.work}`.replace(/\s/g, ''), status: '색인 요청', publishedAt: new Date(), indexRequestedAt: new Date(), sort: -1
  });
  const pages: NewPage[] = [{ kind: '현장 기록', tag: '신규', title, status: '색인 요청' }];
  const live = (await db.select().from(t.pages).where(and(eq(t.pages.partnerId, user.partnerId), eq(t.pages.type, '지역')))).filter((x) => LIVE.includes(x.status) && x.regionKey === place);
  for (const r of live.slice(0, 3)) pages.push({ kind: '지역 페이지', tag: '보강', title: r.title, status: r.status });
  pages.push({ kind: '지역 허브', tag: '갱신', title: `${city} 지역 허브`, status: '발행됨' });

  /* 사진 처리 → 빌드 → 배포 → 색인 전송 (어댑터 결과를 그대로 작업 로그에) */
  const kinds = ['사진 처리', '빌드', '배포', '색인 전송'] as const;
  const results = await Promise.all(kinds.map((kind) => runJob({ kind, reason: null, willFailAgain: false })));
  await db.insert(t.jobs).values(kinds.map((kind, i) => {
    const r = results[i];
    return { partnerId: user.partnerId, kind, status: r.ok ? '성공' as const : '실패' as const, reason: r.ok ? null : r.reason };
  }));
  /* 화면을 다시 그리지 않음: 발행 결과를 보여 준 뒤 '다른 현장 검토하기'로 넘어갈 때 새로 읽음 (모든 화면은 요청마다 새로 그려짐) */
  return { ok: true, title, photos: pub.size, pages };
}

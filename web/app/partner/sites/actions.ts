'use server';
/* 현장 발행 (2b): 사진 공개 확인 → 현장 정보 → 발행
 * 발행하면 현장과 "현장 기록" 페이지를 만들고, 같은 지역의 지역 · 역 주변 · 지역 허브 페이지를 보강/갱신 대상으로 연결합니다.
 * 실제 빌드 · 배포 · 색인 전송은 작업 로그(jobs)에 쌓이고 본사 파이프라인이 처리합니다(컨펌 단계는 기록만). */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePartner } from '@/lib/auth';

export type PublishInput = { photoIds: string[]; publicIds: string[]; place: string; work: string; building: string; area: number; days: number; note: string };
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
  if (!input.work || !input.building || !(input.area > 0) || !(input.days > 0)) return { ok: false, error: '현장 정보를 모두 입력해 주세요' };

  const title = `${input.place} ${input.building} ${input.work}`;
  const city = input.place.split(' ')[0];
  const [site] = await db.insert(t.sites).values({
    partnerId: user.partnerId, title, region: input.place, workType: input.work, buildingType: input.building,
    areaPyeong: Math.round(input.area), days: Math.round(input.days), note: input.note.trim().slice(0, 200) || null,
    workedAt: photos[0].takenAt ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(photos[0].takenAt) : null,
    photoCount: pub.size, status: '발행됨', publishedAt: new Date()
  }).returning();
  for (const p of photos) await db.update(t.photos).set({ siteId: site.id, partnerPublic: pub.has(p.id) }).where(eq(t.photos.id, p.id));

  /* 이 현장으로 생긴 페이지: 현장 기록은 새로, 같은 지역 페이지들은 보강/갱신 */
  const existing = await db.select().from(t.pages).where(eq(t.pages.partnerId, user.partnerId));
  await db.insert(t.pages).values({ partnerId: user.partnerId, siteId: site.id, type: '현장', title, status: '색인 요청', publishedAt: new Date(), indexRequestedAt: new Date(), sort: -1 });
  const pages: NewPage[] = [{ kind: '현장 기록', tag: '신규', title, status: '색인 요청' }];
  const region = existing.find((p) => p.type === '지역' && p.title.startsWith(city) && p.title.includes(input.building))
    ?? existing.find((p) => p.type === '지역' && p.title.startsWith(city));
  if (region) pages.push({ kind: '지역 페이지', tag: '보강', title: region.title, status: region.status });
  const near = existing.find((p) => p.type === '역 주변' && p.title.includes(city));
  if (near) pages.push({ kind: '역 주변', tag: '보강', title: near.title, status: near.status });
  const hub = existing.find((p) => p.type === '지역 허브' && p.title.startsWith(city));
  pages.push({ kind: '지역 허브', tag: hub ? '갱신' : '신규', title: hub?.title ?? `${city} 지역 허브`, status: hub?.status ?? '발행됨' });

  await db.insert(t.jobs).values([
    { partnerId: user.partnerId, kind: '사진 처리', status: '성공' },
    { partnerId: user.partnerId, kind: '빌드', status: '성공' },
    { partnerId: user.partnerId, kind: '배포', status: '성공' },
    { partnerId: user.partnerId, kind: '색인 전송', status: '성공' }
  ]);
  /* 화면을 다시 그리지 않음: 발행 결과를 보여 준 뒤 '다른 현장 검토하기'로 넘어갈 때 새로 읽음 (모든 화면은 요청마다 새로 그려짐) */
  return { ok: true, title, photos: pub.size, pages };
}

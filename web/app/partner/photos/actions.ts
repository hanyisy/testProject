'use server';
/* 사진 추가 (2i): 직접 올리기 · 구글 드라이브 연결/동기화 · 기존 현장에 추가
 * 올린 사진은 공개 확인 전까지 페이지에 쓰이지 않음 (partner_public=false). 같은 파일은 중복으로 건너뜀 */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePartner } from '@/lib/auth';
import { contentHash, putFile } from '@/lib/adapters/storage';
import { readExif } from '@/lib/exif';
import { getSetting } from '@/lib/admin';

const MAX = 15 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export type UploadResult = { ok: true; id: string; duplicate: false } | { ok: true; duplicate: true } | { ok: false; error: string };

export async function uploadPhoto(fd: FormData): Promise<UploadResult> {
  const user = await requirePartner();
  const file = fd.get('file');
  if (!(file instanceof File) || !file.size) return { ok: false, error: '파일이 없어요' };
  if (file.size > MAX) return { ok: false, error: '15MB보다 큰 사진은 올릴 수 없어요' };
  if (file.type && !OK_TYPES.includes(file.type)) return { ok: false, error: '사진 파일만 올릴 수 있어요' };
  const data = Buffer.from(await file.arrayBuffer());
  const hash = contentHash(data);
  const db = await getDb();
  const dup = await db.select({ id: t.photos.id }).from(t.photos).where(and(eq(t.photos.partnerId, user.partnerId), eq(t.photos.contentHash, hash))).limit(1);
  if (dup.length) return { ok: true, duplicate: true };
  const key = `${user.partnerId}/${hash}${file.name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? '.jpg'}`;
  await putFile(key, data);
  /* 촬영 시각: EXIF → 없으면 파일 수정 시각. 위치: EXIF GPS에서 가장 가까운 업체 서비스 지역(30km 안), GPS 없으면 '위치 없음'
   * 동 이름까지는 주소 변환(외부 지도 API)이 필요해서 운영 때 붙임 */
  const exif = readExif(data);
  const modified = Number(fd.get('lastModified'));
  const takenAt = exif.takenAt ?? (Number.isFinite(modified) && modified > 0 ? new Date(modified) : new Date());
  let place: string | null = null;
  if (exif.lat !== undefined && exif.lng !== undefined) {
    const [regions, centers] = await Promise.all([
      db.select({ region: t.partnerRegions.region }).from(t.partnerRegions).where(eq(t.partnerRegions.partnerId, user.partnerId)),
      getSetting<Record<string, [number, number]>>('region_centers', {})
    ]);
    let best = { region: '', km: Infinity };
    for (const { region } of regions) {
      const c = centers[region];
      if (!c) continue;
      const km = distKm(exif.lat, exif.lng, c[0], c[1]);
      if (km < best.km) best = { region, km };
    }
    place = best.km <= 30 ? best.region.split(' ').slice(-1)[0] : '서비스 지역 밖';
  }
  const [row] = await db.insert(t.photos).values({
    partnerId: user.partnerId, fileKey: key, label: file.name.replace(/\.[^.]+$/, ''), contentHash: hash,
    takenAt, place,
    source: '직접 올림', hasPerson: false, partnerPublic: false
  }).returning();
  return { ok: true, id: row.id, duplicate: false };
}

export async function connectDrive() {
  const user = await requirePartner();
  const db = await getDb();
  await db.update(t.partners).set({ driveConnected: true, driveSyncedAt: new Date() }).where(eq(t.partners.id, user.partnerId));
  await db.insert(t.jobs).values({ partnerId: user.partnerId, kind: '사진 처리', status: '성공' });
}

export async function syncDrive() {
  const user = await requirePartner();
  const db = await getDb();
  await db.update(t.partners).set({ driveSyncedAt: new Date() }).where(eq(t.partners.id, user.partnerId));
}

/** 방금 올린 사진을 이미 발행된 현장에 더함 (공개 확인 후 페이지에 반영) */
export async function addToSite(siteId: string, photoIds: string[]) {
  const user = await requirePartner();
  const db = await getDb();
  const [site] = await db.select().from(t.sites).where(and(eq(t.sites.id, siteId), eq(t.sites.partnerId, user.partnerId))).limit(1);
  if (!site || !photoIds.length) return { ok: false as const };
  const rows = await db.update(t.photos).set({ siteId })
    .where(and(eq(t.photos.partnerId, user.partnerId), inArray(t.photos.id, photoIds), isNull(t.photos.siteId))).returning({ id: t.photos.id });
  return { ok: true as const, title: site.title, n: rows.length };
}

function distKm(a1: number, o1: number, a2: number, o2: number) {
  const r = Math.PI / 180;
  const h = Math.sin(((a2 - a1) * r) / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(((o2 - o1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/* 사진 저장 (파트너 사진 추가 2i · 본사 페이지 생성 3r 공용)
 * 같은 파일은 중복으로 건너뜀 · EXIF 촬영 시각/GPS → 가장 가까운 서비스 지역 · 공개 확인 전까지 페이지에 안 쓰임 */
import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { getSetting } from '@/lib/admin';
import { contentHash, putFile } from '@/lib/adapters/storage';
import { readExif } from '@/lib/exif';

const MAX = 15 * 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export type UploadResult = { ok: true; id: string; duplicate: false } | { ok: true; duplicate: true } | { ok: false; error: string };

export async function savePhoto(partnerId: string, file: FormDataEntryValue | null, lastModified: number): Promise<UploadResult> {
  if (!(file instanceof File) || !file.size) return { ok: false, error: '파일이 없어요' };
  if (file.size > MAX) return { ok: false, error: '15MB보다 큰 사진은 올릴 수 없어요' };
  if (file.type && !OK_TYPES.includes(file.type)) return { ok: false, error: '사진 파일만 올릴 수 있어요' };
  const data = Buffer.from(await file.arrayBuffer());
  const hash = contentHash(data);
  const db = await getDb();
  const dup = await db.select({ id: t.photos.id }).from(t.photos).where(and(eq(t.photos.partnerId, partnerId), eq(t.photos.contentHash, hash))).limit(1);
  if (dup.length) return { ok: true, duplicate: true };
  const key = `${partnerId}/${hash}${file.name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? '.jpg'}`;
  await putFile(key, data);
  /* 촬영 시각: EXIF → 없으면 파일 수정 시각. 위치: EXIF GPS에서 가장 가까운 업체 서비스 지역(30km 안), GPS 없으면 '위치 없음'
   * 동 이름까지는 주소 변환(외부 지도 API)이 필요해서 운영 때 붙임 */
  const exif = readExif(data);
  const takenAt = exif.takenAt ?? (Number.isFinite(lastModified) && lastModified > 0 ? new Date(lastModified) : new Date());
  let place: string | null = null;
  if (exif.lat !== undefined && exif.lng !== undefined) {
    const [regions, centers] = await Promise.all([
      db.select({ region: t.partnerRegions.region }).from(t.partnerRegions).where(eq(t.partnerRegions.partnerId, partnerId)),
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
    partnerId, fileKey: key, label: file.name.replace(/\.[^.]+$/, ''), contentHash: hash, takenAt, place,
    source: '직접 올림', hasPerson: false, partnerPublic: false
  }).returning();
  return { ok: true, id: row.id, duplicate: false };
}

function distKm(a1: number, o1: number, a2: number, o2: number) {
  const r = Math.PI / 180;
  const h = Math.sin(((a2 - a1) * r) / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(((o2 - o1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

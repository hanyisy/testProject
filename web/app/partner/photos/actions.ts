'use server';
/* 사진 추가 (2i): 직접 올리기 · 구글 드라이브 연결/동기화/폴더 바꾸기 · 기존 현장에 추가
 * 올린 사진은 공개 확인 전까지 페이지에 쓰이지 않음 (partner_public=false). 같은 파일은 중복으로 건너뜀
 * 드라이브는 어댑터(lib/adapters/drive)로 — 컨펌 단계는 Drive API 없이 연결 · 시각만 */
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePartner } from '@/lib/auth';
import { savePhoto } from '@/lib/photos';
import { connectFolder, syncFolder } from '@/lib/adapters/drive';

export type { UploadResult } from '@/lib/photos';

export async function uploadPhoto(fd: FormData) {
  const user = await requirePartner();
  return savePhoto(user.partnerId, fd.get('file'), Number(fd.get('lastModified')));
}

/** 드라이브 폴더 연결 · 폴더 바꾸기 (같은 동작: 주소 확인 → 저장 → 바로 한 번 동기화) */
export async function connectDrive(url: string) {
  const user = await requirePartner();
  const r = await connectFolder(url);
  if (!r.ok) return r;
  const db = await getDb();
  await db.update(t.partners).set({ driveFolderUrl: url.trim(), driveConnected: true, driveSyncedAt: new Date() }).where(eq(t.partners.id, user.partnerId));
  revalidatePath('/partner', 'layout');
  return r;
}

export async function syncDrive() {
  const user = await requirePartner();
  const db = await getDb();
  const [p] = await db.select({ url: t.partners.driveFolderUrl }).from(t.partners).where(eq(t.partners.id, user.partnerId)).limit(1);
  const r = await syncFolder(p?.url ?? null);
  if (r.ok) await db.update(t.partners).set({ driveSyncedAt: new Date() }).where(eq(t.partners.id, user.partnerId));
  revalidatePath('/partner', 'layout');
  return r;
}

/** 방금 올린 사진을 이미 발행된 현장에 더함 — 고른 현장에 넣는 것 자체가 공개 확인이라 공개로,
 *  사람이 찍힌 사진만 비공개로 남김 · 현장 사진 수 갱신 */
export async function addToSite(siteId: string, photoIds: string[]) {
  const user = await requirePartner();
  const db = await getDb();
  const [site] = await db.select().from(t.sites).where(and(eq(t.sites.id, siteId), eq(t.sites.partnerId, user.partnerId))).limit(1);
  if (!site || !photoIds.length) return { ok: false as const };
  const rows = await db.update(t.photos).set({ siteId, partnerPublic: sql`not ${t.photos.hasPerson}` })
    .where(and(eq(t.photos.partnerId, user.partnerId), inArray(t.photos.id, photoIds), isNull(t.photos.siteId))).returning({ id: t.photos.id, pub: t.photos.partnerPublic });
  const pub = rows.filter((r) => r.pub).length;
  await db.update(t.sites).set({ photoCount: sql`${t.sites.photoCount} + ${pub}` }).where(eq(t.sites.id, siteId));
  revalidatePath('/partner', 'layout');
  return { ok: true as const, title: site.title, n: rows.length, hidden: rows.length - pub };
}

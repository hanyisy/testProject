'use server';
/* 사진 추가 (2i): 직접 올리기 · 구글 드라이브 연결/동기화 · 기존 현장에 추가
 * 올린 사진은 공개 확인 전까지 페이지에 쓰이지 않음 (partner_public=false). 같은 파일은 중복으로 건너뜀 */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePartner } from '@/lib/auth';
import { savePhoto } from '@/lib/photos';

export type { UploadResult } from '@/lib/photos';

export async function uploadPhoto(fd: FormData) {
  const user = await requirePartner();
  return savePhoto(user.partnerId, fd.get('file'), Number(fd.get('lastModified')));
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


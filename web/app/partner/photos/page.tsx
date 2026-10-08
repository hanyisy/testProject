import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
import PartnerTop from '@/components/PartnerTop';
import { requirePartner } from '@/lib/auth';
import { getDb, schema as t } from '@/db/client';
import { today } from '@/lib/config';
import { md, rel } from '@/lib/format';
import { photoGroups } from '@/lib/partner-app';
import PhotoActions from '../PhotoActions';
import Uploader from './Uploader';
import DriveCard from './DriveCard';

export const metadata = { title: '사진 추가' };

/* 시안 2i(드라이브 연결됨 · 올리는 중) · 2i-2(드라이브 연결 전) · 2i-3(올린 뒤) — 모바일 1i */
export default async function PhotosPage() {
  const user = await requirePartner();
  const db = await getDb();
  const [[p], sites, groups, day] = await Promise.all([
    db.select().from(t.partners).where(eq(t.partners.id, user.partnerId)).limit(1),
    db.select().from(t.sites).where(and(eq(t.sites.partnerId, user.partnerId), eq(t.sites.status, '발행됨'))).orderBy(desc(t.sites.workedAt)).limit(5),
    photoGroups(user.partnerId),
    today()
  ]);
  const newPhotos = groups.reduce((a, g) => a + g.photos.length, 0);
  return (
    <>
      <PartnerTop title="사진 추가" actions={<PhotoActions newPhotos={newPhotos} />} />
      <div className="ppage">
        <Link href="/partner/sites" className="back">‹ 현장</Link>
        <Uploader
          sites={sites.map((s) => ({ id: s.id, title: s.title, date: md(s.workedAt), n: s.photoCount }))}
          drive={<DriveCard connected={p.driveConnected} url={p.driveFolderUrl} folderName={p.name + " 현장사진"} synced={p.driveSyncedAt ? rel(p.driveSyncedAt, day) : "아직 없음"} />}
        />
      </div>
    </>
  );
}

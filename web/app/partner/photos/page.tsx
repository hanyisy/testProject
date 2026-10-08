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
import { connectDrive, syncDrive } from './actions';

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
          drive={
            p.driveConnected ? (
              <section className="pcard" style={{ padding: 22, gap: 12 }}>
                <div className="row" style={{ alignItems: 'center' }}><span className="panel__title">구글 드라이브</span><span className="chip chip--ok">연결됨</span></div>
                <div className="box-surf box-surf--pad" style={{ gap: 3 }}>
                  <b style={{ fontSize: 16 }}>{p.name} 현장사진</b>
                  <span className="hint" style={{ fontSize: 14 }}>마지막 동기화 {p.driveSyncedAt ? rel(p.driveSyncedAt, day) : '아직 없음'}</span>
                </div>
                <span className="muted">이 폴더에 사진을 넣으면 자동으로 올라와요</span>
                <div className="row">
                  <form action={syncDrive} style={{ flex: 1 }}><button className="btn-ghost" style={{ width: '100%', height: 48, borderRadius: 14, fontSize: 15 }}>지금 동기화</button></form>
                  <button type="button" className="btn-ghost" style={{ height: 48, borderRadius: 14, fontSize: 15 }}>폴더 바꾸기</button>
                </div>
              </section>
            ) : (
              <section className="pcard" style={{ padding: 22, gap: 14 }}>
                <div className="row" style={{ alignItems: 'center' }}><span className="panel__title">구글 드라이브</span><span className="chip chip--gray">연결 전</span></div>
                <span style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text2)' }}>드라이브 폴더를 연결해 두면, 폰에서 폴더에 사진을 넣기만 해도 자동으로 올라와요.</span>
                {['구글 계정으로 로그인', '현장 사진을 넣을 폴더 고르기', '끝 · 새 사진은 하루 한 번 자동으로 가져와요'].map((s, i) => (
                  <div key={s} className="step-n" style={{ alignItems: 'center' }}><span className="step-n__i">{i + 1}</span><span style={{ fontSize: 15, fontWeight: 600 }}>{s}</span></div>
                ))}
                <form action={connectDrive}><button className="pbtn pbtn--accent" style={{ width: '100%', height: 54, borderRadius: 16, fontSize: 17 }}>드라이브 폴더 연결하기</button></form>
              </section>
            )
          }
        />
      </div>
    </>
  );
}

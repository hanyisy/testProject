import Link from 'next/link';
import { and, asc, eq } from 'drizzle-orm';
import PartnerTop from '@/components/PartnerTop';
import ListState from '@/components/ListState';
import { requirePartner } from '@/lib/auth';
import { photoGroups } from '@/lib/partner-app';
import { getDb, schema as t } from '@/db/client';
import PhotoActions from '../PhotoActions';
import Publisher from './Publisher';

export const metadata = { title: '현장 발행' };

/* 시안 2b(데스크톱) · 1b(모바일) — 현장 발행: 사진 검토 → 현장 정보 → 발행 */
export default async function SitesPage({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const user = await requirePartner();
  const { g } = await searchParams;
  const db = await getDb();
  const [groups, [p]] = await Promise.all([
    photoGroups(user.partnerId),
    db.select({ industryId: t.partners.industryId }).from(t.partners).where(eq(t.partners.id, user.partnerId)).limit(1)
  ]);
  /* 작업 종류 · 건물 유형 선택지는 업종 템플릿에서 */
  const items = await db.select().from(t.industryItems).where(and(eq(t.industryItems.industryId, p.industryId))).orderBy(asc(t.industryItems.sort));
  const works = items.filter((i) => i.group === '작업 종류').map((i) => i.label);
  const buildings = items.filter((i) => i.group === '대상 유형').map((i) => i.label);
  const total = groups.reduce((a, x) => a + x.photos.length, 0);
  const sel = groups.find((x) => x.key === g) ?? groups[0];
  const md = (ymd: string) => { const m = /\d{4}-(\d{2})-(\d{2})/.exec(ymd); return m ? `${Number(m[1])}월 ${Number(m[2])}일` : ymd; };
  return (
    <>
      <PartnerTop title="현장 발행" actions={<PhotoActions newPhotos={total} />} />
      <div className="ppage">
        <div className="row" style={{ alignItems: 'center', gap: 12 }}>
          <span className="pnote" style={{ fontSize: 15, fontWeight: 600, color: 'var(--sub)' }}>
            {total ? `새 사진 ${total}장이 검토를 기다려요` : '검토할 새 사진이 없어요'}
          </span>
          {/* 기획서 7장: 데스크톱 현장 발행의 "사진 추가" 버튼 중복을 고침 — 상단 줄 버튼 하나만 */}
        </div>
        {!sel ? (
          <ListState kind="empty" title="새 사진이 들어오면 여기서 현장으로 묶어 발행해요" desc="사진을 올리거나 드라이브 폴더를 연결해 주세요"
            action={<Link href="/partner/photos" className="btn-line">사진 추가</Link>} />
        ) : (
          <Publisher
            groups={groups.map((x) => ({ key: x.key, label: `${md(x.day)} · ${x.place} · 사진 ${x.photos.length}장` }))}
            current={sel.key}
            place={sel.place}
            photos={sel.photos.map((ph) => ({ id: ph.id, label: ph.label ?? '사진', person: ph.hasPerson, pub: ph.partnerPublic }))}
            works={works}
            buildings={buildings}
          />
        )}
      </div>
    </>
  );
}

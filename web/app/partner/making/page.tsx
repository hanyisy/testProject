import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
import PartnerTop from '@/components/PartnerTop';
import ListState from '@/components/ListState';
import { requirePartner } from '@/lib/auth';
import { partnerMaking } from '@/lib/partner-app';
import { getDb, schema as t } from '@/db/client';
import PhotoActions from '../PhotoActions';
import Making from './Making';

export const metadata = { title: '만들고 있는 페이지' };

/* 시안 2j(데스크톱) · 1j(모바일) — 만들고 있는 페이지 */
export default async function MakingPage() {
  const user = await requirePartner();
  const mk = await partnerMaking(user.partnerId);
  const db = await getDb();
  const sites = await db.select().from(t.sites).where(and(eq(t.sites.partnerId, user.partnerId), eq(t.sites.status, '발행됨'))).orderBy(desc(t.sites.workedAt)).limit(3);
  return (
    <>
      <PartnerTop title="만들고 있는 페이지" actions={<PhotoActions newPhotos={mk?.newPhotos ?? 0} />} />
      <div className="ppage">
        <Link href="/partner/search" className="back">‹ 검색 노출</Link>
        {!mk ? (
          <ListState kind="empty" title="지금 만들고 있는 페이지가 없어요" desc="본사가 새 페이지를 만들기 시작하면 여기서 진행 상황을 볼 수 있어요" />
        ) : (
          <>
            <div className="mkhead"><h2>{mk.run.pageType} {mk.total}장</h2><span>{mk.cities}</span></div>
            <div className="pcard mksteps">
              {[[mk.steps.drafted ? '시안 준비됨' : '시안 준비 중', mk.steps.drafted], ['확인 요청 도착', mk.steps.requested], ['검수 중', mk.steps.inReview], [`배포 ${mk.deployed}/${mk.total}`, mk.total > 0 && mk.deployed >= mk.total]].map(([label, done], i) => (
                <div key={String(label)} className="mksteps__i">
                  <span className="mksteps__n">{done ? '✓' : i + 1}</span>
                  <span className="mksteps__l" style={{ fontWeight: done ? 600 : 800 }}>{label}</span>
                  {i < 3 && <span className="mksteps__line" />}
                </div>
              ))}
            </div>
            {mk.newPhotos > 0 && <div className="okbox">새 사진 {mk.newPhotos}장이 다음 배분에 반영돼요</div>}
            <div className="infobox infobox--i"><span className="infobox__i">i</span>페이지 구성과 배포는 본사에서 진행해요</div>
            <Making
              runId={mk.run.id}
              drafts={mk.drafts.map((d) => ({ label: d.label, style: d.style, n: d.n, like: d.partnerLike, note: d.partnerNote, href: d.href }))}
              preview={mk.preview}
              work={mk.run.pageType.split('×').pop() ?? ''}
              partnerName={mk.partnerName}
              timeline={sites.map((s) => ({ title: s.title, date: s.workedAt ?? '' }))}
              usage={mk.usage}
            />
          </>
        )}
      </div>
    </>
  );
}

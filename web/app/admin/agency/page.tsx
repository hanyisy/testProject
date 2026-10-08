import Link from 'next/link';
import { and, desc, eq, gt, inArray, or } from 'drizzle-orm';
import TopBar from '@/components/TopBar';
import ListState from '@/components/ListState';
import { requirePerm } from '@/lib/auth';
import { getDb, schema as t } from '@/db/client';
import { workCounts } from '@/lib/admin';
import AgencyJob from './AgencyJob';

export const metadata = { title: '대행 작업' };

/* 시안 3m — 대행 작업: 복사 → 주소 입력 → 완료 */
export default async function AgencyPage() {
  const user = await requirePerm('대행 작업');
  const db = await getDb();
  const week = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [jobs, waiting, counts] = await Promise.all([
    db.select({ b: t.blogPosts, partner: t.partners.name }).from(t.blogPosts).innerJoin(t.partners, eq(t.partners.id, t.blogPosts.partnerId))
      .where(and(eq(t.blogPosts.mode, '본사 대행'), or(eq(t.blogPosts.status, '승인'), and(eq(t.blogPosts.status, '올림'), gt(t.blogPosts.publishedAt, week)))))
      .orderBy(desc(t.blogPosts.approvedOn), t.blogPosts.sort),
    /* 본사 대행으로 쓰는 파트너의 아직 승인 안 된 초안 */
    db.select({ partner: t.partners.name }).from(t.blogPosts).innerJoin(t.partners, eq(t.partners.id, t.blogPosts.partnerId))
      .innerJoin(t.partnerFeatures, eq(t.partnerFeatures.partnerId, t.partners.id))
      .where(and(eq(t.partnerFeatures.blog, '본사 대행'), inArray(t.blogPosts.status, ['초안', '승인 대기']))),
    workCounts()
  ]);
  const open = jobs.filter((j) => j.b.status === '승인');
  const done = jobs.filter((j) => j.b.status === '올림');
  const waitNames = Array.from(new Set(waiting.map((w) => w.partner)));
  return (
    <>
      <TopBar title="대행 작업" user={user} />
      <div className="page">
        <section className="panel" style={{ padding: 22, gap: 12 }}>
          <div className="panel__head" style={{ alignItems: 'center' }}>
            <h2 className="panel__title">블로그 대행</h2><span className="panel__sub">파트너가 승인한 글</span>
            <span className="muted" style={{ marginLeft: 'auto', fontSize: 14 }}>파트너 승인 전 {waiting.length}건{waitNames.length ? ` · ${waitNames.join(' · ')}` : ''}</span>
          </div>
          {!jobs.length && <ListState kind="empty" title="올릴 글이 없어요" desc="파트너가 초안을 승인하면 여기에 떠요" />}
          {[...open, ...done].map(({ b, partner }) => (
            <div key={b.id} className={'agjob' + (b.status === '올림' ? ' is-done' : '')}>
              <div className="row" style={{ alignItems: 'center', gap: 10 }}>
                <span className="agjob__meta">{partner} · 승인 {b.approvedOn ?? '—'}</span>
                <span className={`chip chip--${b.status === '올림' ? 'ok' : 'info'}`}>{b.status === '올림' ? '완료' : '파트너 승인'}</span>
              </div>
              <b className="agjob__title">{b.title}</b>
              {b.status === '승인' ? <AgencyJob id={b.id} text={[b.title, ...b.body].join('\n\n')} /> : <span className="agjob__url">{b.url}</span>}
            </div>
          ))}
        </section>
        <Link href="/admin/review?type=번역" className="panel linkpanel">
          <div className="stack" style={{ gap: 3, flex: 1 }}>
            <b style={{ fontSize: 17 }}>번역 검수는 검수 메뉴에서 묶음으로 처리해요</b>
            <span className="muted" style={{ fontSize: 14 }}>{counts.translationSub || '번역'} 대기 {counts.translations}장</span>
          </div>
          <span className="chev" aria-hidden="true" style={{ fontSize: 20 }}>›</span>
        </Link>
      </div>
    </>
  );
}

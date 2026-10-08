import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import TopBar from '@/components/TopBar';
import { requirePerm } from '@/lib/auth';
import { getDb, schema as t } from '@/db/client';
import { REASON_CHIP, reviewBundle, segs } from '@/lib/review';
import { decideItem } from '../actions';
import BundleTable, { Toast } from './BundleTable';

export const metadata = { title: '검수 · 묶음' };

const ICOLS = 'minmax(0,0.9fr) minmax(0,1.3fr) 60px 60px 80px 290px';

/* 시안 3p — 검수 묶음 상세 (묶음 · 개별 검수 필요 탭) */
export default async function BundlePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; h?: string }> }) {
  const user = await requirePerm('검수');
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const b = await reviewBundle(id);
  if (!b) notFound();
  const indN = b.ex.filter((e) => e.state === '개별 검수').length;
  const tab = sp.tab === 'ind' ? 'ind' : 'bundle';
  const db = await getDb();
  const [toast] = sp.h ? await db.select().from(t.reviewHistory).where(eq(t.reviewHistory.id, sp.h)).limit(1).catch(() => []) : [];

  return (
    <>
      <TopBar title="검수" user={user} />
      <div className="page">
        <div className="stack" style={{ gap: 12 }}>
          <Link href="/admin/review" className="back">‹ 검수 목록</Link>
          <div className="dhead__row">
            <span className="dhead__title">{b.partner} · {b.kind} · {b.rows.length}장</span>
            <span className="chip chip--plain">{b.type}</span>
            <span className="dhead__meta">만든 날 {b.createdOn} · 검수 완료 {b.rows.length - b.pend}/{b.rows.length}</span>
          </div>
          <nav className="tabs" aria-label="묶음 보기">
            <Link href={`/admin/review/${b.id}`} className="tab" aria-current={tab === 'bundle' ? 'true' : undefined}>묶음<span className="tab__n">{b.rows.length}장</span></Link>
            <Link href={`/admin/review/${b.id}?tab=ind`} className="tab" aria-current={tab === 'ind' ? 'true' : undefined}>개별 검수 필요<span className={'tab__n' + (indN ? ' tab__n--red' : '')}>{indN}장</span></Link>
          </nav>
        </div>
        {toast && !toast.reverted && <Toast id={toast.id} text={`${toast.what} · ${toast.bundleLabel}`} />}

        {tab === 'bundle' ? (
          <div className="rvgrid">
            <section className="panel rvbody">
              <div className="panel__head"><h2 className="panel__title">공통 본문</h2><span className="panel__sub">{b.rows.length}장이 같이 써요</span></div>
              {b.commonBody.map((p, i) => <p key={i} className="rvp">{segs(p).map((g, k) => g.tok ? <span key={k} className="tok">{g.t}</span> : g.t)}</p>)}
              <div className="row" style={{ alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--line2)' }}><span className="tok" style={{ fontSize: 13 }}>파란 칸</span><span className="hint">페이지마다 다른 부분 · 오른쪽 표</span></div>
              <Link href={`/admin/review/${b.id}/edit`} className="btn-ghost" style={{ height: 46, justifyContent: 'center', fontSize: 15, fontWeight: 800 }}>공통 본문 수정</Link>
            </section>
            <BundleTable key={b.rows.map((r) => r.state).join()} bundleId={b.id} c1={b.col1} c2={b.col2} minUnique={b.minUnique}
              rows={b.rows.map((r) => ({ id: r.id, name: r.name, info: r.info, photos: r.photos, sites: r.sites, uniq: r.uniquePct, state: r.state, selected: r.selected }))} />
          </div>
        ) : (
          <section className="table">
            <div className="rvbar"><b style={{ fontSize: 15 }}>개별 검수 필요</b><span className="hint" style={{ fontSize: 14 }}>묶음에서 자동으로 빠졌어요 · 한 장씩 열어서 확인해 주세요</span></div>
            <div className="table__scroll">
              <div className="table__head" style={{ '--cols': ICOLS, '--min': '900px' } as React.CSSProperties}><span>{b.col1}</span><span>빠진 이유</span><span className="r">사진</span><span className="r">현장</span><span className="r">고유 내용</span><span /></div>
              {!b.ex.length ? <div className="lstate"><span className="lstate__title">빠진 페이지가 없어요</span></div> : b.ex.map((e) => {
                const wait = e.state === '개별 검수';
                return (
                  <div key={e.id} className="table__row" style={{ '--cols': ICOLS, '--min': '900px', minHeight: 60 } as React.CSSProperties}>
                    <b style={{ fontSize: 16, opacity: wait ? 1 : 0.5 }}>{e.name}</b>
                    <div className="stack" style={{ gap: 6, opacity: wait ? 1 : 0.5 }}>
                      <div className="tags" style={{ gap: 6 }}>{e.reasons.map((x) => <span key={x} className={`chip chip--${REASON_CHIP[x] ?? 'gray'}`}>{x}</span>)}</div>
                      {e.note && <span className="hint">{e.note}</span>}
                      {!e.sites && <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--red)' }}>현장이 없어 발행할 수 없어요</span>}
                    </div>
                    <span className="cell-num cell-num--n">{e.photos}</span>
                    <span className="cell-num cell-num--n">{e.sites || '—'}</span>
                    <span className="cell-num" style={{ color: e.uniquePct < b.minUnique ? 'var(--red)' : undefined }}>{e.uniquePct}%</span>
                    <span className="cell-act">
                      {wait ? (
                        <>
                          <Link href={`/admin/review/${b.id}/edit?preview=${e.id}`} className="btn-ghost btn-ghost--sm">열어서 보기</Link>
                          <form action={decideItem.bind(null, e.id, 'skip')}><button className="btn-ghost btn-ghost--sm">발행 안 함</button></form>
                          <form action={decideItem.bind(null, e.id, 'done')}><button className="btn-ink btn-ink--sm" disabled={!e.sites} title={!e.sites ? '현장이 없어 발행할 수 없어요' : undefined}>검수 완료</button></form>
                        </>
                      ) : <span className={`chip chip--${e.state === '검수 완료' ? 'ok' : 'gray'}`}>{e.state === '검수 완료' ? '검수 완료' : '발행 안 함'}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

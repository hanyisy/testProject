import Link from 'next/link';
import PartnerTop from '@/components/PartnerTop';
import Pager, { paginate } from '@/components/Pager';
import FilterSelect from '@/components/FilterSelect';
import ListState from '@/components/ListState';
import { requirePartner } from '@/lib/auth';
import { partnerMaking, partnerSearch } from '@/lib/partner-app';
import PhotoActions from '../PhotoActions';

export const metadata = { title: '검색 노출' };

const IDX: Record<string, string> = { '발행됨': 'gray', '색인 요청': 'warn', '색인 확인': 'ok' };
const TYPES = ['전체', '현장', '지역', '역 주변', '가이드', '질문'];
const SERIES: [string, string][] = [['현장', 'var(--ink)'], ['지역', 'var(--c2)'], ['가이드', 'var(--c3)'], ['질문', 'var(--c4)']];
type SP = { type?: string; idx?: string; sort?: string; page?: string };

/* 시안 2c(데스크톱) · 1c(모바일) — 검색 노출 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePartner();
  const sp = await searchParams;
  const [s, mk] = await Promise.all([partnerSearch(user.partnerId), partnerMaking(user.partnerId)]);
  const type = TYPES.includes(sp.type ?? '') ? sp.type! : '전체';
  let rows = s.pages.filter((p) => type === '전체' || p.type === type).filter((p) => !sp.idx || p.status === sp.idx);
  if ((sp.sort ?? 'clicks') === 'clicks') rows = [...rows].sort((a, b) => b.visits30d - a.visits30d);
  const { cur, items } = paginate(rows, Number(sp.page), 10);
  const href = (o: Partial<SP>) => {
    const v = { ...sp, ...o };
    const q = new URLSearchParams(Object.entries(v).filter(([k, x]) => x && !(k === 'type' && x === '전체') && !(k === 'page' && x === '1')) as [string, string][]);
    return '/partner/search' + (q.toString() ? '?' + q : '');
  };
  const maxQ = s.queries[0]?.clicks || 1;
  const maxBar = Math.max(1, ...s.chart.map((m) => m.v.reduce((a, b) => a + b, 0)));
  return (
    <>
      <PartnerTop title="검색 노출" actions={<PhotoActions newPhotos={mk?.newPhotos ?? 0} />} />
      <div className="ppage">
        {mk && (
          <Link href="/partner/making" className="pcard makingcard">
            <div className="makingcard__txt"><b>만들고 있는 페이지</b><span>{mk.run.pageType} {mk.total}장</span></div>
            <span className="chip chip--info">배포 중 {mk.deployed}/{mk.total}</span>
            <span className="chev">›</span>
          </Link>
        )}
        <div className="pgrid pgrid--3">
          <div className="pcard pstat"><span className="pcard__k">발행 페이지</span><span className="pstat__n">{s.pages.length}<small>장</small></span></div>
          <div className="pcard pstat"><span className="pcard__k">색인 확인</span><span className="pstat__n">{s.indexed}<small>장</small></span><span className="pnote">대기 {s.waiting}장 · 대부분 {s.indexDays}일 안에 끝나요</span></div>
          <div className="pcard pstat"><span className="pcard__k">이번 달 검색 클릭</span><span className="pstat__n">{s.monthClicks}<small>회</small></span>{s.vsPrev !== null && <span className="pnote">지난달 같은 기간 대비 {s.vsPrev >= 0 ? '+' : ''}{s.vsPrev}회</span>}</div>
        </div>

        <div className="pgrid pgrid--search">
          <div className="stack" style={{ gap: 12 }}>
            <div className="filters filters--scroll">
              <span className="filters__label only-desk">필터</span>
              <FilterSelect name="clicks" label="클릭 기간" value="month" options={[{ value: 'month', label: '이번 달' }]} />
              <FilterSelect name="idx" label="색인 상태" value={sp.idx ?? ''} options={[{ value: '', label: '전체' }, ...Object.keys(IDX).map((x) => ({ value: x, label: x }))]} />
              <FilterSelect name="sort" label="정렬" value={sp.sort ?? 'clicks'} options={[{ value: 'clicks', label: '클릭 많은 순' }, { value: 'type', label: '유형 순' }]} />
              {(sp.idx || sp.sort) && <Link href={href({ idx: '', sort: '', page: '' })} className="reset-link only-desk">초기화</Link>}
            </div>
            <section className="pcard plist">
              <div className="plist__chips">
                {TYPES.map((x) => (
                  <Link key={x} href={href({ type: x, page: '' })} className="sel sel--md" aria-pressed={type === x}>
                    {x}<span className="sel__n">{x === '전체' ? s.pages.length : s.pages.filter((p) => p.type === x).length}</span>
                  </Link>
                ))}
              </div>
              <div className="plist__head"><span style={{ width: 60 }}>유형</span><span style={{ flex: 1 }}>페이지</span><span>색인 상태</span><span style={{ width: 64, textAlign: 'right' }}>이번 달 클릭</span></div>
              {items.map((p) => (
                <div key={p.id} className="plist__row">
                  <span className="chip chip--plain">{p.type}</span>
                  <span className="plist__t">{p.title}</span>
                  <span className={`chip chip--${IDX[p.status] ?? 'gray'}`}>{p.status}</span>
                  <span className="plist__c" style={{ color: p.visits30d ? 'var(--ink)' : 'var(--sub3)' }}>{p.visits30d ? `${p.visits30d}회` : '—'}</span>
                </div>
              ))}
              {!items.length && <ListState kind="empty" title="해당하는 페이지가 없어요" />}
              <Pager page={cur} size={10} total={rows.length} href={(n) => href({ page: String(n) })} />
            </section>
          </div>
          <section className="pcard pcard--lg" style={{ gap: 6, padding: '22px 24px' }}>
            <div className="pcard__head" style={{ paddingBottom: 6 }}><span className="pcard__title">실제 유입 검색어</span><span className="pcard__sub" style={{ fontSize: 13 }}>이번 달 클릭</span></div>
            {s.queries.map((q, i) => (
              <div key={q.id} className="qrow">
                <span className="qrow__rank">{i + 1}</span>
                <div className="qrow__mid"><span>{q.query}</span><span className="qrow__bar"><span style={{ width: `${(q.clicks / maxQ) * 100}%` }} /></span></div>
                <span className="qrow__n">{q.clicks}회</span>
              </div>
            ))}
            {!s.queries.length && <span className="empty-line">아직 유입 검색어가 없어요</span>}
          </section>
        </div>

        {s.chart.length > 0 && (
          <section className="pcard chartcard">
            <div className="pcard__head"><span className="chartcard__title">검색 유입 문의</span><span className="pcard__sub">최근 {s.chart.length}개월 · 페이지 유형별</span></div>
            <div className="sbars">
              {s.chart.map((m) => {
                const total = m.v.reduce((a, b) => a + b, 0);
                return (
                  <div key={m.mon} className="sbars__col">
                    <span className="sbars__total">{total}</span>
                    <div className="sbars__stack" style={{ height: `${(total / maxBar) * 86}%` }}>
                      {m.v.map((n, i) => ({ n, i })).filter((g) => g.n > 0).reverse().map((g) => (
                        <span key={g.i} style={{ flex: g.n, background: SERIES[g.i][1] }} title={`${SERIES[g.i][0]} ${g.n}`} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="sbars__months">{s.chart.map((m) => <span key={m.mon}>{m.mon}</span>)}</div>
            <div className="legend legend--sm">{SERIES.map(([l, c]) => <span key={l}><i style={{ background: c }} />{l}</span>)}</div>
          </section>
        )}
      </div>
    </>
  );
}

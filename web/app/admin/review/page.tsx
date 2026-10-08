import Link from 'next/link';
import TopBar from '@/components/TopBar';
import Pager, { paginate } from '@/components/Pager';
import FilterSelect from '@/components/FilterSelect';
import ListState from '@/components/ListState';
import { requirePerm } from '@/lib/auth';
import { reviewList } from '@/lib/review';
import { undoHistory } from './actions';

export const metadata = { title: '검수' };

type SP = { partner?: string; type?: string; made?: string; page?: string; hp?: string; hwho?: string; hpage?: string };
const BCOLS = 'minmax(0,1.7fr) 90px 80px minmax(0,1fr) 120px 84px';
const HCOLS = '110px 100px minmax(0,1fr) 84px 96px';
const daysAgo = (day: string, n: number) => new Date(new Date(day + 'T00:00:00+09:00').getTime() - n * 864e5).toISOString().slice(0, 10);

/* 시안 3o — 검수: 같은 뼈대 페이지를 묶음으로 */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePerm('검수');
  const sp = await searchParams;
  const r = await reviewList();
  const href = (o: Partial<SP>) => {
    const q = new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([k, v]) => v && !((k === 'page' || k === 'hpage') && v === '1')) as [string, string][]);
    return '/admin/review' + (q.toString() ? '?' + q : '');
  };

  const madeDays = sp.made === 'all' ? 0 : sp.made === '7' ? 7 : 30;
  const bundles = r.bundles
    .filter((b) => !sp.partner || b.partner === sp.partner)
    .filter((b) => !sp.type || b.type === sp.type)
    .filter((b) => !madeDays || !b.createdDate || b.createdDate >= daysAgo(r.day, madeDays));
  const bp = paginate(bundles, Number(sp.page), 5);

  const histDays = sp.hp === 'all' ? 0 : sp.hp === '30' ? 30 : 7;
  const realToday = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
  const hist = r.history
    .filter((h) => !histDays || h.createdAt.getTime() >= Date.now() - histDays * 864e5)
    .filter((h) => !sp.hwho || h.whoLabel === sp.hwho);
  const hp = paginate(hist, Number(sp.hpage), 5);
  const whos = Array.from(new Set(r.history.map((h) => h.whoLabel)));
  const partners = Array.from(new Set(r.bundles.map((b) => b.partner)));
  const when = (h: (typeof hist)[number]) => h.whenText && h.whenText !== '방금' ? h.whenText
    : `${h.day === realToday ? '오늘' : h.day.slice(5).replace('-', '/')} ${new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(h.createdAt)}`;

  return (
    <>
      <TopBar title="검수" user={user} />
      <div className="page">
        <div className="grid grid--4">
          <div className="stat"><span className="stat__label">검수 대기 묶음</span><span className="stat__num">{r.stats.bundleWait}<small>개</small></span><span className="stat__note">파트너 {r.stats.partnerWait}곳</span></div>
          <div className="stat"><span className="stat__label">묶음 대기 페이지</span><span className="stat__num">{r.stats.pageWait}<small>장</small></span><span className="stat__note">번역 {r.stats.transWait}장 포함</span></div>
          <div className="stat"><span className="stat__label">개별 검수 필요</span><span className="stat__num">{r.stats.indWait}<small>장</small></span><span className="stat__note">묶음에서 자동으로 빠진 페이지</span></div>
          <div className="stat"><span className="stat__label">오늘 검수 완료</span><span className="stat__num">{r.stats.doneToday}<small>장</small></span><span className="stat__note">일괄 {r.stats.batchToday}건</span></div>
        </div>

        <div className="filters">
          <span className="filters__label">필터</span>
          <FilterSelect name="partner" label="파트너" value={sp.partner ?? ''} options={[{ value: '', label: '전체' }, ...partners.map((p) => ({ value: p, label: p }))]} />
          <FilterSelect name="type" label="유형" value={sp.type ?? ''} options={[{ value: '', label: '전체' }, ...['지역', '번역', '질문'].map((x) => ({ value: x, label: x }))]} />
          <FilterSelect name="made" label="만든 날" value={sp.made ?? ''} options={[{ value: '', label: '최근 30일' }, { value: '7', label: '최근 7일' }, { value: 'all', label: '전체' }]} />
          {(sp.partner || sp.type || sp.made) && <Link href="/admin/review" className="reset-link">초기화</Link>}
        </div>
        <section className="table">
          <div className="tablehead"><h2 className="panel__title">검수 대기 묶음</h2><span className="panel__sub">공통 본문은 한 번만, 다른 부분만 표로 확인</span></div>
          <div className="table__scroll">
            <div className="table__head" style={{ '--cols': BCOLS, '--min': '880px' } as React.CSSProperties}><span>묶음</span><span>유형</span><span className="r">페이지</span><span>진행</span><span>개별 검수</span><span /></div>
            {!bp.items.length ? <ListState kind="empty" title="조건에 맞는 묶음이 없어요" /> : bp.items.map((b) => (
              <div key={b.id} className="table__row" style={{ '--cols': BCOLS, '--min': '880px', minHeight: 60 } as React.CSSProperties}>
                <span className="cell-name"><b style={{ fontSize: 16 }}>{b.partner} · {b.kind}</b><small style={{ fontSize: 13 }}>만든 날 {b.createdOn} · 공통 본문 1개</small></span>
                <span><span className="chip chip--plain">{b.type}</span></span>
                <span className="cell-num">{b.total}장</span>
                <span className="progline"><span className="bar"><span style={{ width: `${b.total ? Math.round((b.done / b.total) * 100) : 0}%` }} /></span><b>{b.done}/{b.total}</b></span>
                <span>{b.ind ? <span className="chip chip--red">{b.ind}장 빠짐</span> : <span className="chip chip--gray">없음</span>}</span>
                <Link href={`/admin/review/${b.id}`} className="btn-ghost btn-ghost--sm" style={{ justifyContent: 'center' }}>열기</Link>
              </div>
            ))}
          </div>
          <Pager page={bp.cur} size={5} total={bundles.length} href={(n) => href({ page: String(n) })} />
        </section>

        <div className="grid grid--1-19">
          <section className="panel" style={{ padding: 22 }}>
            <div className="panel__head"><h2 className="panel__title">묶음에서 자동으로 빠지는 기준</h2><Link href="/admin/settings#review" className="link-accent" style={{ marginLeft: 'auto' }}>설정에서 변경 ›</Link></div>
            <div className="gap8" />
            {[[`고유 내용 ${r.minUnique}% 미만`, '지역명만 바뀐 페이지를 거르는 기준', '고유 내용 부족'], [`사진 ${r.minPhotos}장 미만`, '실제 현장 사진이 모자란 페이지', '사진 부족'], ['자동 점검 경고', '중복 문장 · 확인 안 된 수치 · 연락처 누락', '점검 경고']].map(([a, b, c], i) => (
              <div key={c} className="critrow" style={i ? { borderTop: '1px solid var(--line2)' } : undefined}>
                <div><b>{a}</b><small>{b}</small></div><span className={`chip chip--${c === '사진 부족' ? 'warn' : 'red'}`}>{c}</span>
              </div>
            ))}
            <span className="hint" style={{ paddingTop: 8, borderTop: '1px solid var(--line2)' }}>빠진 페이지는 일괄 승인할 수 없고, 한 장씩 열어서 검수해요</span>
          </section>
          <section className="table">
            <div className="tablehead"><h2 className="panel__title">일괄 작업 기록</h2><span className="panel__sub">한 건으로 기록돼 직전 상태로 되돌릴 수 있어요</span></div>
            <div className="filters" style={{ padding: '0 20px 10px' }}>
              <FilterSelect name="hp" label="기간" value={sp.hp ?? ''} options={[{ value: '', label: '최근 7일' }, { value: '30', label: '최근 30일' }, { value: 'all', label: '전체' }]} />
              <FilterSelect name="hwho" label="담당자" value={sp.hwho ?? ''} options={[{ value: '', label: '전체' }, ...whos.map((w) => ({ value: w, label: w }))]} />
            </div>
            <div className="table__scroll">
              <div className="table__head" style={{ '--cols': HCOLS, '--min': '620px' } as React.CSSProperties}><span>일시</span><span>담당자</span><span>작업</span><span>결과</span><span /></div>
              {!hp.items.length ? <ListState kind="empty" title="기록이 없어요" /> : hp.items.map((h) => (
                <div key={h.id} className="table__row" style={{ '--cols': HCOLS, '--min': '620px', minHeight: 60 } as React.CSSProperties}>
                  <span className="cell-sub ell" style={{ fontSize: 15 }}>{when(h)}</span>
                  <b className="cell-strong ell" style={{ fontSize: 15 }}>{h.whoLabel}</b>
                  <span className="cell-name"><b className="ell">{h.what}</b><small className="ell" style={{ fontSize: 13 }}>{h.bundleLabel}</small></span>
                  <span><span className={`chip chip--${h.reverted ? 'gray' : 'ok'}`}>{h.reverted ? '되돌림' : '완료'}</span></span>
                  <span className="cell-act">{!h.reverted && <form action={undoHistory.bind(null, h.id)}><button className="btn-ghost btn-ghost--xs">되돌리기</button></form>}</span>
                </div>
              ))}
            </div>
            <Pager page={hp.cur} size={5} total={hist.length} href={(n) => href({ hpage: String(n) })} />
          </section>
        </div>
      </div>
    </>
  );
}

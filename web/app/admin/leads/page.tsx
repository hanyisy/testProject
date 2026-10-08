import Link from 'next/link';
import TopBar from '@/components/TopBar';
import Pager, { paginate } from '@/components/Pager';
import FilterSelect from '@/components/FilterSelect';
import ListState from '@/components/ListState';
import { requirePerm } from '@/lib/auth';
import { LEAD_STATUSES, LEAD_STATUS_CHIP, leadList } from '@/lib/admin';
import { today as getToday } from '@/lib/config';
import { md } from '@/lib/format';

export const metadata = { title: '가입 문의' };

const BIZ = ['전체', '철거', '입주청소', '인테리어', '바닥 시공', '기타'];
const PERIODS = [{ value: '30', label: '최근 30일' }, { value: '7', label: '최근 7일' }, { value: 'all', label: '전체' }];
const COLS = '84px minmax(0,1fr) 120px minmax(0,1.1fr) 128px 112px 84px 76px 20px';

type SP = { tab?: string; biz?: string; period?: string; owner?: string; page?: string };

/* 시안 3-lead — 랜딩의 가입 문의 폼으로 들어온 문의 */
export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePerm('파트너 관리');
  const sp = await searchParams;
  const [all, today] = await Promise.all([leadList(), getToday()]);
  const tab = LEAD_STATUSES.includes(sp.tab as never) ? sp.tab! : '전체';
  const biz = BIZ.includes(sp.biz ?? '') ? sp.biz! : '전체';
  const period = sp.period ?? '30';
  const owner = sp.owner ?? '';

  const cutoff = period === 'all' ? 0 : new Date(today + 'T00:00:00+09:00').getTime() - (Number(period) - 1) * 86400000;
  const inPeriod = all.filter((l) => l.receivedAt.getTime() >= cutoff);
  const rows = inPeriod
    .filter((l) => tab === '전체' || l.status === tab)
    .filter((l) => biz === '전체' || l.industry.startsWith(biz))
    .filter((l) => !owner || (owner === '미지정' ? !l.owner : l.owner === owner));
  const { cur, items } = paginate(rows, Number(sp.page), 10);

  const q = (o: Partial<SP>) => {
    const p = new URLSearchParams();
    const v = { tab, biz, period, owner, ...o };
    if (v.tab !== '전체') p.set('tab', v.tab);
    if (v.biz !== '전체') p.set('biz', v.biz);
    if (v.period !== '30') p.set('period', v.period);
    if (v.owner) p.set('owner', v.owner);
    if (o.page && o.page !== '1') p.set('page', o.page);
    const s = p.toString();
    return '/admin/leads' + (s ? '?' + s : '');
  };
  const owners = Array.from(new Set(all.map((l) => l.owner).filter(Boolean)));
  const thisMonth = today.slice(0, 7);

  return (
    <>
      <TopBar title="가입 문의" user={user} />
      <div className="page">
        <div className="grid grid--3">
          <div className="stat"><span className="stat__label">신규</span><span className="stat__num">{all.filter((l) => l.status === '신규').length}<small>건</small></span><span className="stat__note">아직 연락 전</span></div>
          <div className="stat"><span className="stat__label">상담 중</span><span className="stat__num">{all.filter((l) => l.status === '상담 중').length}<small>건</small></span><span className="stat__note">담당 직원이 상담하고 있어요</span></div>
          <div className="stat"><span className="stat__label">이번 달 계약</span><span className="stat__num">{all.filter((l) => l.status === '계약' && l.receivedAt.toISOString().slice(0, 7) === thisMonth).length}<small>건</small></span><span className="stat__note">파트너로 등록됐어요</span></div>
        </div>

        <nav className="tabs" aria-label="상태">
          {['전체', ...LEAD_STATUSES].map((s) => (
            <Link key={s} href={q({ tab: s })} className="tab" aria-current={s === tab ? 'true' : undefined}>
              {s}<span className="tab__n">{s === '전체' ? inPeriod.length : inPeriod.filter((l) => l.status === s).length}</span>
            </Link>
          ))}
        </nav>

        <div className="filters">
          <span className="filters__label">업종</span>
          {BIZ.map((b) => <Link key={b} href={q({ biz: b })} className="pill" aria-current={b === biz ? 'true' : undefined}>{b}</Link>)}
          <span className="filters__sep" />
          <FilterSelect name="period" label="접수일" value={period} options={PERIODS} />
          <FilterSelect name="owner" label="담당" value={owner} options={[{ value: '', label: '전체' }, { value: '미지정', label: '미지정' }, ...owners.map((o) => ({ value: o, label: o }))]} />
        </div>

        <div className="table">
          <div className="table__scroll">
            <div className="table__head" style={{ '--cols': COLS, '--min': '1090px' } as React.CSSProperties}>
              <span>접수일</span><span>상호</span><span>업종</span><span>지역</span><span>담당자 연락처</span><span>신청 가능</span><span>상태</span><span>담당</span><span />
            </div>
            {items.map((l) => (
              <Link key={l.id} href={`/admin/leads/${l.id}`} className="table__row" style={{ '--cols': COLS, '--min': '1090px' } as React.CSSProperties}>
                <span className="cell-sub">{md(l.receivedAt)}</span>
                <span className="cell-name"><b>{l.company}</b><small>{l.manager}{l.requestType === 'waitlist' && ' · 대기 신청'}</small></span>
                <span className="cell-strong ell" title={l.industry}>{l.industry}</span>
                <span className="cell-ell">{l.regions.join(', ') || '—'}</span>
                <span className="cell-mono">{l.phone}</span>
                <span><span className={`chip chip--${l.av[1]}`}>{l.av[0]}</span></span>
                <span><span className={`chip chip--${LEAD_STATUS_CHIP[l.status]}`}>{l.status}</span></span>
                <span className="cell-strong" style={{ color: l.owner ? 'var(--ink)' : 'var(--red)' }}>{l.owner || '미지정'}</span>
                <span className="chev" aria-hidden="true" style={{ fontSize: 18 }}>›</span>
              </Link>
            ))}
          </div>
          {!items.length && <ListState kind="empty" title="조건에 맞는 문의가 없어요" desc="다른 상태나 업종을 골라 보세요" />}
          <Pager page={cur} size={10} total={rows.length} href={(p) => q({ page: String(p) })} />
        </div>
      </div>
    </>
  );
}

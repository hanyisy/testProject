import Link from 'next/link';
import TopBar from '@/components/TopBar';
import Pager, { paginate } from '@/components/Pager';
import FilterSelect from '@/components/FilterSelect';
import ListState from '@/components/ListState';
import { requirePerm } from '@/lib/auth';
import { PARTNER_STATUS_CHIP } from '@/lib/constants';
import { partnerList, regionText } from '@/lib/partners';

export const metadata = { title: '파트너' };

const STATUSES = ['전체', '운영 중', '준비 중', '종료'];
const COLS = 'minmax(0,1.2fr) 96px minmax(0,1.2fr) 80px 88px 150px 96px 96px 24px';
type SP = { st?: string; q?: string; biz?: string; plan?: string; since?: string; page?: string };

/* 시안 3b — 파트너 목록 */
export default async function PartnersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePerm('파트너 관리');
  const sp = await searchParams;
  const all = await partnerList();
  const st = STATUSES.includes(sp.st ?? '') ? sp.st! : '전체';
  const q = (sp.q ?? '').trim();
  const since = sp.since ?? '';
  const sinceMs = since ? Date.now() - Number(since) * 86400000 : 0;
  const base = all
    .filter((p) => !q || p.name.includes(q))
    .filter((p) => !sp.biz || p.industry === sp.biz)
    .filter((p) => !sp.plan || p.plan === sp.plan)
    .filter((p) => !sinceMs || p.createdAt.getTime() >= sinceMs);
  const rows = base.filter((p) => st === '전체' || p.status === st);
  const { cur, items } = paginate(rows, Number(sp.page), 10);
  const href = (o: Partial<SP>) => {
    const v = { ...sp, ...o };
    const p = new URLSearchParams(Object.entries(v).filter(([k, x]) => x && !(k === 'st' && x === '전체') && !(k === 'page' && x === '1')) as [string, string][]);
    const s = p.toString();
    return '/admin/partners' + (s ? '?' + s : '');
  };
  const uniq = (xs: string[]) => Array.from(new Set(xs)).map((x) => ({ value: x, label: x }));
  const filtered = !!(sp.biz || sp.plan || since || q);

  return (
    <>
      <TopBar title="파트너" user={user} />
      <div className="page">
        <div className="toolbar">
          <nav className="seg seg--w420" aria-label="상태">
            {STATUSES.map((s) => (
              <Link key={s} href={href({ st: s, page: '' })} className="seg__opt seg__opt--sm" aria-pressed={s === st}>
                {s}<span className="seg__n">{s === '전체' ? base.length : base.filter((p) => p.status === s).length}</span>
              </Link>
            ))}
          </nav>
          <form action="/admin/partners" role="search">
            {st !== '전체' && <input type="hidden" name="st" value={st} />}
            <input className="search-box" name="q" defaultValue={q} placeholder="업체명 검색" aria-label="업체명 검색" />
          </form>
          <Link href="/admin/partners/new" className="btn-add">+ 파트너 추가</Link>
        </div>
        <div className="filters">
          <span className="filters__label">필터</span>
          <FilterSelect name="biz" label="업종" value={sp.biz ?? ''} options={[{ value: '', label: '전체' }, ...uniq(all.map((p) => p.industry))]} />
          <FilterSelect name="plan" label="요금제" value={sp.plan ?? ''} options={[{ value: '', label: '전체' }, ...uniq(all.map((p) => p.plan))]} />
          <FilterSelect name="since" label="등록일" value={since} options={[{ value: '', label: '전체 기간' }, { value: '30', label: '최근 30일' }, { value: '90', label: '최근 90일' }]} />
          {filtered && <Link href="/admin/partners" className="reset-link">초기화</Link>}
        </div>

        <div className="table">
          <div className="table__scroll">
            <div className="table__head" style={{ '--cols': COLS, '--min': '1040px' } as React.CSSProperties}>
              <span>업체명</span><span>업종</span><span>서비스 지역</span><span>요금제</span><span style={{ textAlign: 'right' }}>발행 페이지</span><span>색인 비율</span><span style={{ textAlign: 'right' }}>이번 달 문의</span><span>상태</span><span />
            </div>
            {items.map((p) => (
              <div key={p.id} className="table__row" style={{ '--cols': COLS, '--min': '1040px', minHeight: 60 } as React.CSSProperties}>
                <Link href={`/admin/partners/${p.id}`} className="cell-link">{p.name}</Link>
                <span className="cell-txt">{p.industry}</span>
                <span className="cell-txt">{regionText(p.regions)}</span>
                <span><span className="chip chip--plain">{p.plan}</span></span>
                <span className="num">{p.pages || '—'}</span>
                <div className="bar-pct">
                  <span className="bar-pct__track"><span className="bar-pct__fill" style={{ width: `${p.indexPct ?? 0}%` }} /></span>
                  <span className="bar-pct__n">{p.indexPct === null ? '—' : `${p.indexPct}%`}</span>
                </div>
                <span className="num">{p.inquiries ?? '—'}</span>
                <span><span className={`chip chip--${PARTNER_STATUS_CHIP[p.status]}`}>{p.status}</span></span>
                <Link href={`/admin/partners/${p.id}`} className="chev" aria-label={`${p.name} 상세`}>›</Link>
              </div>
            ))}
          </div>
          {!items.length && <ListState kind="empty" title="조건에 맞는 파트너가 없어요" desc="필터를 바꾸거나 초기화해 보세요" />}
          <Pager page={cur} size={10} total={rows.length} href={(n) => href({ page: String(n) })} />
        </div>
      </div>
    </>
  );
}

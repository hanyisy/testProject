import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import TopBar from '@/components/TopBar';
import Pager, { paginate } from '@/components/Pager';
import FilterSelect from '@/components/FilterSelect';
import ListState from '@/components/ListState';
import { requirePerm } from '@/lib/auth';
import { getDb, schema as t } from '@/db/client';
import { today } from '@/lib/config';
import { hm, md } from '@/lib/format';
import JobButtons from './JobButtons';

export const metadata = { title: '작업 로그' };

type SP = { f?: string; period?: string; partner?: string; kind?: string; page?: string };
const COLS = '70px 110px 100px 110px minmax(0,1fr) 220px';
const KINDS = ['사진 처리', '빌드', '배포', '색인 전송', '시트 동기화'];
const kst = (d: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(d);

/* 시안 3k — 작업 로그: 재시도 → 다시 실패하면 전달 버튼 */
export default async function JobsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePerm('작업 로그');
  const sp = await searchParams;
  const db = await getDb();
  const [rows, day] = await Promise.all([
    db.select({ j: t.jobs, partner: t.partners.name }).from(t.jobs).leftJoin(t.partners, eq(t.partners.id, t.jobs.partnerId)).orderBy(desc(t.jobs.createdAt)),
    today()
  ]);
  /* 기간: 오늘(시안 기준일) · 최근 7일 · 최근 30일 */
  const days = sp.period === '7' ? 7 : sp.period === '30' ? 30 : 0;
  const from = new Date(new Date(day + 'T00:00:00+09:00').getTime() - days * 864e5);
  const inPeriod = rows
    .filter(({ j }) => days ? j.createdAt >= from : kst(j.createdAt) === day)
    .filter((r) => !sp.partner || r.partner === sp.partner)
    .filter(({ j }) => !sp.kind || j.kind === sp.kind);
  const failed = inPeriod.filter(({ j }) => j.status !== '성공');
  const list = sp.f === 'fail' ? failed : inPeriod;
  const { cur, items } = paginate(list, Number(sp.page), 10);
  const partners = Array.from(new Set(rows.map((r) => r.partner).filter((x): x is string => !!x)));
  const href = (o: Partial<SP>) => {
    const q = new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([k, v]) => v && !(k === 'page' && v === '1')) as [string, string][]);
    return '/admin/jobs' + (q.toString() ? '?' + q : '');
  };

  return (
    <>
      <TopBar title="작업 로그" user={user} />
      <div className="page">
        <div className="row" style={{ alignItems: 'center', gap: 12 }}>
          <nav className="seg seg--w300" aria-label="결과">
            <Link href={href({ f: '', page: '' })} className="seg__opt" aria-pressed={sp.f !== 'fail'}>전체<span className="seg__n">{inPeriod.length}</span></Link>
            <Link href={href({ f: 'fail', page: '' })} className="seg__opt" aria-pressed={sp.f === 'fail'}>실패<span className="seg__n">{failed.length}</span></Link>
          </nav>
          <span className="hint" style={{ marginLeft: 'auto', fontSize: 14, whiteSpace: 'nowrap' }}>오늘 {md(day)}</span>
        </div>
        <div className="filters">
          <span className="filters__label">필터</span>
          <FilterSelect name="period" label="기간" value={sp.period ?? ''} options={[{ value: '', label: '오늘' }, { value: '7', label: '최근 7일' }, { value: '30', label: '최근 30일' }]} />
          <FilterSelect name="partner" label="파트너" value={sp.partner ?? ''} options={[{ value: '', label: '전체' }, ...partners.map((p) => ({ value: p, label: p }))]} />
          <FilterSelect name="kind" label="작업" value={sp.kind ?? ''} options={[{ value: '', label: '전체' }, ...KINDS.map((k) => ({ value: k, label: k }))]} />
          {(sp.period || sp.partner || sp.kind) && <Link href={href({ period: '', partner: '', kind: '', page: '' })} className="reset-link">초기화</Link>}
        </div>
        <section className="table">
          <div className="table__scroll">
            <div className="table__head" style={{ '--cols': COLS, '--min': '900px' } as React.CSSProperties}><span>시간</span><span>파트너</span><span>작업</span><span>결과</span><span>실패 사유</span><span /></div>
            {!items.length ? <ListState kind="empty" title={sp.f === 'fail' ? '실패한 작업이 없어요' : '이 기간에 작업이 없어요'} /> : items.map(({ j, partner }) => {
              const ok = j.status === '성공';
              return (
                <div key={j.id} className="table__row" style={{ '--cols': COLS, '--min': '900px', minHeight: 60, background: j.status === '실패' ? 'var(--field)' : undefined } as React.CSSProperties}>
                  <span className="cell-sub" style={{ fontSize: 15 }}>{days ? `${md(j.createdAt).replace('월 ', '/').replace('일', '')} ${hm(j.createdAt)}` : hm(j.createdAt)}</span>
                  <b className="cell-strong ell" style={{ fontSize: 15 }}>{partner ?? '본사'}</b>
                  <span className="cell-ell" style={{ fontWeight: 600, fontSize: 15 }}>{j.kind}</span>
                  <span><span className={`chip chip--${ok ? 'ok' : 'red'}`}>{ok ? (j.tries > 1 ? '성공 · 재시도' : '성공') : '실패'}</span></span>
                  <span style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.4 }}>{ok ? '' : `${j.reason ?? ''}${j.tries > 1 ? ` · 재시도 ${j.tries - 1}회 실패` : ''}`}</span>
                  <span className="cell-act"><JobButtons id={j.id} status={j.status} tries={j.tries} /></span>
                </div>
              );
            })}
          </div>
          <Pager page={cur} size={10} total={list.length} href={(n) => href({ page: String(n) })} />
        </section>
      </div>
    </>
  );
}

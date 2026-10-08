import Link from 'next/link';
import { asc } from 'drizzle-orm';
import TopBar from '@/components/TopBar';
import Pager, { paginate } from '@/components/Pager';
import FilterSelect from '@/components/FilterSelect';
import ListState from '@/components/ListState';
import { requireStaff } from '@/lib/auth';
import { getDb, schema as t } from '@/db/client';
import { getSetting, type DemoStats } from '@/lib/admin';

export const metadata = { title: '발행·색인' };

type SP = { st?: string; page?: string };
const COLS = 'minmax(0,1.2fr) 100px 100px 100px minmax(0,1.2fr)';

/** "6–10일" → [6, 10] · "미색인" → null */
const range = (label: string) => { const m = label.match(/(\d+)[–-](\d+)/); return m ? [Number(m[1]), Number(m[2])] as const : null; };

/* 색인 기간 분포에서 중앙값 · 90% 기준일 · 그 앞 구간까지의 비율 계산 */
function measure(hist: [string, number][]) {
  const total = hist.reduce((a, [, n]) => a + n, 0);
  const idx = hist.filter(([l]) => range(l));
  const indexed = idx.reduce((a, [, n]) => a + n, 0);
  const at = (target: number) => {
    let cum = 0;
    for (const [l, n] of idx) {
      const [a, z] = range(l)!;
      if (cum + n >= target) return { day: a + ((target - cum) / n) * (z - a + 1), end: z, start: a };
      cum += n;
    }
    return { day: 0, end: 0, start: 0 };
  };
  const p90 = at(indexed * 0.9);
  const within = p90.start - 1;
  const inN = idx.filter(([l]) => range(l)![1] <= within).reduce((a, [, n]) => a + n, 0);
  return { total, within, withinPct: total ? Math.round((inN / total) * 100) : 0, median: Math.floor(at(indexed / 2).day), p90: p90.end };
}

/* 시안 3j — 발행·색인 (파트너별 합계는 시안 데모 합계 → 운영에서는 pages 집계로 바뀜) */
export default async function IndexingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireStaff();
  const sp = await searchParams;
  const db = await getDb();
  const [partners, stats, idxDays] = await Promise.all([
    db.select({ name: t.partners.name, status: t.partners.status }).from(t.partners).orderBy(asc(t.partners.createdAt)),
    getSetting<(DemoStats & { indexHist?: [string, number][] }) | null>('demo_stats', null),
    getSetting<number>('index_days', 23)
  ]);
  const rows = partners.map((p) => {
    const s = stats?.partners[p.name] ?? { pages: 0, indexed: 0, requested: 0 };
    return { ...p, pub: s.pages, req: s.requested, ok: s.indexed, ratio: s.pages ? s.indexed / s.pages : null };
  });
  const sum = (xs: typeof rows, k: 'pub' | 'req' | 'ok') => xs.reduce((a, r) => a + r[k], 0);
  const live = rows.filter((r) => r.status === '운영 중');
  const livePct = sum(live, 'pub') ? Math.round((sum(live, 'ok') / sum(live, 'pub')) * 100) : 0;
  const m = measure(stats?.indexHist ?? []);
  const maxBar = Math.max(1, ...(stats?.indexHist ?? []).map(([, n]) => n));

  const list = rows.filter((r) => !sp.st || r.status === sp.st);
  const { cur, items } = paginate(list, Number(sp.page), 10);

  return (
    <>
      <TopBar title="발행·색인" user={user} />
      <div className="page">
        <div className="grid grid--4">
          <div className="stat"><span className="stat__label">전체 발행</span><span className="stat__num">{sum(rows, 'pub')}<small>장</small></span><span className="stat__note">종료 파트너 포함</span></div>
          <div className="stat"><span className="stat__label">색인 확인</span><span className="stat__num">{sum(rows, 'ok')}<small>장</small></span><span className="stat__note">색인 요청 {sum(rows, 'req')} · 미요청 {sum(rows, 'pub') - sum(rows, 'ok') - sum(rows, 'req')}</span></div>
          <div className="stat"><span className="stat__label">운영 중 색인 비율</span><span className="stat__num">{livePct}<small>%</small></span><span className="stat__note">{sum(live, 'pub')}장 중 {sum(live, 'ok')}장</span></div>
          <div className="stat"><span className="stat__label">{m.within}일 안 색인</span><span className="stat__num">{m.withinPct}<small>%</small></span><span className="stat__note">최근 90일 발행 {m.total}장 기준</span></div>
        </div>
        <div className="filters">
          <span className="filters__label">필터</span>
          <FilterSelect name="period" label="발행 기간" value="90" options={[{ value: '90', label: '최근 90일' }]} />
          <FilterSelect name="st" label="파트너 상태" value={sp.st ?? ''} options={[{ value: '', label: '전체' }, ...['운영 중', '준비 중', '종료'].map((s) => ({ value: s, label: s }))]} />
          {sp.st && <Link href="/admin/indexing" className="reset-link">초기화</Link>}
        </div>
        <section className="table">
          <div className="tablehead"><h2 className="panel__title">파트너별</h2></div>
          <div className="table__scroll">
            <div className="table__head" style={{ '--cols': COLS, '--min': '700px' } as React.CSSProperties}><span>파트너</span><span className="r">발행</span><span className="r">색인 요청</span><span className="r">색인 확인</span><span>색인 비율</span></div>
            {!items.length ? <ListState kind="empty" title="조건에 맞는 파트너가 없어요" /> : items.map((r) => (
              <div key={r.name} className="table__row" style={{ '--cols': COLS, '--min': '700px', minHeight: 60 } as React.CSSProperties}>
                <b className="cell-strong ell" style={{ fontSize: 15 }}>{r.name}{r.status !== '운영 중' ? ` · ${r.status}` : ''}</b>
                <span className="cell-num">{r.pub}</span><span className="cell-num">{r.req}</span><span className="cell-num">{r.ok}</span>
                <span className="progline">
                  <span className="bar"><span style={{ width: `${Math.round((r.ratio ?? 0) * 100)}%`, background: (r.ratio ?? 0) >= 0.8 ? 'var(--ink)' : 'var(--red)' }} /></span>
                  <b style={{ width: 48, fontSize: 15 }}>{r.ratio === null ? '—' : `${Math.round(r.ratio * 100)}%`}</b>
                </span>
              </div>
            ))}
          </div>
          <Pager page={cur} size={10} total={list.length} href={(n) => `/admin/indexing?${new URLSearchParams({ ...(sp.st ? { st: sp.st } : {}), page: String(n) })}`} />
        </section>

        <section className="panel idxmeasure">
          <div className="stack" style={{ gap: 10 }}>
            <h2 className="panel__title">색인 기간 실측</h2>
            <span className="idxmeasure__big">발행 페이지의 {m.withinPct}%가 {m.within}일 안에 색인됨</span>
            <span className="hint" style={{ fontSize: 14, lineHeight: 1.6 }}>최근 90일 발행 {m.total}장 기준 · 중앙값 {m.median}일<br />90%가 {m.p90}일 안에 색인돼 파트너 안내 문구는 {idxDays}일로 표시 중</span>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <div className="hbars">
              {(stats?.indexHist ?? []).map(([label, n]) => {
                const r = range(label);
                const bg = !r ? 'var(--red)' : r[1] <= m.within ? 'var(--ink)' : 'var(--c3)';
                return <div key={label}><b>{n}</b><span style={{ height: Math.round((n / maxBar) * 180), background: bg }} /></div>;
              })}
            </div>
            <div className="hbars__x">{(stats?.indexHist ?? []).map(([label]) => <span key={label}>{label}</span>)}</div>
            <div className="legend"><span><i style={{ background: 'var(--ink)' }} />{m.within}일 안</span><span><i style={{ background: 'var(--c3)' }} />{m.within + 1}일 이후</span><span><i style={{ background: 'var(--red)' }} />미색인</span></div>
          </div>
        </section>
      </div>
    </>
  );
}

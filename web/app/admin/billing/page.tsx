import Link from 'next/link';
import { and, desc, eq, gt, inArray, or } from 'drizzle-orm';
import TopBar from '@/components/TopBar';
import Pager, { paginate } from '@/components/Pager';
import FilterSelect from '@/components/FilterSelect';
import ListState from '@/components/ListState';
import { requirePerm } from '@/lib/auth';
import { getDb, schema as t } from '@/db/client';
import { getSetting, type DemoStats } from '@/lib/admin';
import { today } from '@/lib/config';
import { md, won, type ChipKind } from '@/lib/format';
import { closeSettlements } from '@/lib/settlement';
import { confirmDeposit, issueTax } from './actions';

export const metadata = { title: '문의·정산' };

type SP = { year?: string; st?: string; page?: string };
const COLS = 'minmax(0,1fr) 120px 110px 160px 90px 150px 150px';
const DAY = 24 * 3600 * 1000;

/* 시안 3l — 문의·정산 */
export default async function BillingAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePerm('입금 확인 · 세금계산서');
  const sp = await searchParams;
  await closeSettlements();
  const db = await getDb();
  const recent = new Date(Date.now() - DAY);
  const [deposits, taxes, settles, stats, day] = await Promise.all([
    db.select({ c: t.charges, partner: t.partners.name }).from(t.charges).innerJoin(t.partners, eq(t.partners.id, t.charges.partnerId))
      .where(and(eq(t.charges.method, '계좌 입금'), or(eq(t.charges.state, '입금 대기'), and(eq(t.charges.state, '입금 확인'), gt(t.charges.confirmedAt, recent)))))
      .orderBy(desc(t.charges.billedOn)),
    db.select({ x: t.taxRequests, c: t.charges, partner: t.partners.name }).from(t.taxRequests)
      .innerJoin(t.charges, eq(t.charges.id, t.taxRequests.chargeId)).innerJoin(t.partners, eq(t.partners.id, t.charges.partnerId))
      .where(or(eq(t.taxRequests.state, '요청됨'), and(eq(t.taxRequests.state, '발행 완료'), gt(t.taxRequests.issuedAt, recent))))
      .orderBy(desc(t.taxRequests.requestedOn)),
    db.select({ s: t.settlements, partner: t.partners.name }).from(t.settlements).innerJoin(t.partners, eq(t.partners.id, t.settlements.partnerId)).orderBy(desc(t.settlements.month)),
    getSetting<DemoStats | null>('demo_stats', null),
    today()
  ]);
  const chargeIds = settles.map((r) => r.s.chargeId).filter((x): x is string => !!x);
  const settleCharges = chargeIds.length ? await db.select({ id: t.charges.id, state: t.charges.state }).from(t.charges).where(inArray(t.charges.id, chargeIds)) : [];
  const month = day.slice(0, 7);
  const nextM = Number(month.slice(5)) % 12 + 1;
  const stOf = (s: (typeof settles)[number]['s']): [string, ChipKind] => {
    if (!s.chargeId) return [`${s.month < month ? Number(s.month.slice(5)) % 12 + 1 : nextM}월 1일 청구 예정`, 'gray'];
    const st = settleCharges.find((c) => c.id === s.chargeId)?.state;
    return st === '입금 확인' || st === '결제 완료' ? ['입금 확인', 'ok'] : ['청구됨 · 입금 대기', 'warn'];
  };

  const waiting = deposits.filter((r) => r.c.state === '입금 대기');
  const cur = settles.filter((r) => r.s.month === month);
  const partnerInq = stats ? Object.entries(stats.partners).filter(([, v]) => v.inquiries > 0).map(([k, v]) => `${k} ${v.inquiries}`) : [];

  const years = Array.from(new Set(settles.map((r) => r.s.month.slice(0, 4))));
  const year = sp.year ?? day.slice(0, 4);
  const rows = settles.filter((r) => r.s.month.startsWith(year)).filter((r) => {
    if (!sp.st) return true;
    const [label] = stOf(r.s);
    return sp.st === '청구 예정' ? label.endsWith('청구 예정') : label === sp.st;
  });
  const { cur: page, items } = paginate(rows, Number(sp.page), 10);
  const href = (o: Partial<SP>) => {
    const q = new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([k, v]) => v && !(k === 'page' && v === '1')) as [string, string][]);
    return '/admin/billing' + (q.toString() ? '?' + q : '');
  };

  return (
    <>
      <TopBar title="문의·정산" user={user} />
      <div className="page">
        <div className="grid grid--3">
          <div className="stat"><span className="stat__label">이번 달 문의</span><span className="stat__num">{stats?.monthInquiries ?? 0}<small>건</small></span>
            <span className="stat__note">{[...partnerInq, stats ? `본인 아님 ${stats.notMine} 제외` : ''].filter(Boolean).join(' · ')}</span></div>
          <div className="stat"><span className="stat__label">입금 확인 대기</span><span className="stat__num">{won(waiting.reduce((a, r) => a + r.c.amount, 0))}<small>원</small></span>
            <span className="stat__note">{waiting.length}건</span></div>
          <div className="stat"><span className="stat__label">이번 달 정산 예정</span><span className="stat__num">{won(cur.reduce((a, r) => a + r.s.fee, 0))}<small>원</small></span>
            <span className="stat__note">{cur.map((r) => `${r.partner} · ${Number(month.slice(5))}월 경유 계약 ${r.s.contractCount}건`).join(' · ') || '진행 중인 정산 없음'}</span></div>
        </div>

        <div className="grid grid--2" style={{ alignItems: 'start' }}>
          <section className="table">
            <div className="tablehead"><h2 className="panel__title">입금 확인 대기</h2><span className="panel__sub">계좌 입금 건</span></div>
            <div className="table__scroll">
            <div className="table__head" style={{ '--cols': 'minmax(140px,1fr) 110px 128px', '--min': '440px' } as React.CSSProperties}><span>파트너 · 항목</span><span className="r">금액</span><span /></div>
            {!deposits.length ? <ListState kind="empty" title="확인할 입금이 없어요" /> : deposits.map(({ c, partner }) => (
              <div key={c.id} className="table__row" style={{ '--cols': 'minmax(140px,1fr) 110px 128px', '--min': '440px', minHeight: 60 } as React.CSSProperties}>
                <span className="cell-name"><b className="ell">{partner}</b><small>{c.item} · 입금자명 {c.payer ?? partner}</small></span>
                <span className="cell-num">{won(c.amount)}</span>
                <span className="cell-act">
                  {c.state === '입금 대기'
                    ? <form action={confirmDeposit.bind(null, c.id)}><button className="btn-ink btn-ink--sm">입금 확인</button></form>
                    : <span className="chip chip--ok">입금 확인</span>}
                </span>
              </div>
            ))}
            </div>
          </section>
          <section className="table">
            <div className="tablehead"><h2 className="panel__title">세금계산서 발행 요청</h2></div>
            <div className="table__scroll">
            <div className="table__head" style={{ '--cols': 'minmax(140px,1fr) 100px 138px', '--min': '440px' } as React.CSSProperties}><span>파트너 · 항목</span><span className="r">금액</span><span /></div>
            {!taxes.length ? <ListState kind="empty" title="발행 요청이 없어요" /> : taxes.map(({ x, c, partner }) => (
              <div key={x.id} className="table__row" style={{ '--cols': 'minmax(140px,1fr) 100px 138px', '--min': '440px', minHeight: 60 } as React.CSSProperties}>
                <span className="cell-name"><b className="ell">{partner}</b><small>{c.item} · 요청 {md(x.requestedOn)}</small></span>
                <span className="cell-num">{won(c.amount)}</span>
                <span className="cell-act">
                  {x.state === '요청됨'
                    ? <form action={issueTax.bind(null, x.id)}><button className="btn-ink btn-ink--sm">발행 완료 처리</button></form>
                    : <span className="chip chip--ok">발행 완료</span>}
                </span>
              </div>
            ))}
            </div>
          </section>
        </div>

        <div className="filters">
          <span className="filters__label">필터</span>
          <FilterSelect name="year" label="정산 기간" value={year} options={(years.includes(year) ? years : [year, ...years]).map((y) => ({ value: y, label: `${y}년` }))} />
          <FilterSelect name="st" label="상태" value={sp.st ?? ''} options={[{ value: '', label: '전체' }, { value: '청구 예정', label: '청구 예정' }, { value: '청구됨 · 입금 대기', label: '입금 대기' }, { value: '입금 확인', label: '입금 확인' }]} />
          {(sp.year || sp.st) && <Link href="/admin/billing" className="reset-link">초기화</Link>}
        </div>
        <section className="table">
          <div className="tablehead"><h2 className="panel__title">지원형 파트너 정산</h2><span className="panel__sub">우리 사이트 경유 계약 금액 × 정산율</span></div>
          <div className="table__scroll">
            <div className="table__head" style={{ '--cols': COLS, '--min': '1100px' } as React.CSSProperties}>
              <span>파트너</span><span>기간</span><span className="r">경유 계약</span><span className="r">계약 금액</span><span className="r">정산율</span><span className="r">정산 금액</span><span>상태</span>
            </div>
            {!items.length ? <ListState kind="empty" title="조건에 맞는 정산이 없어요" /> : items.map(({ s, partner }) => {
              const [label, chip] = stOf(s);
              return (
                <div key={s.id} className="table__row" style={{ '--cols': COLS, '--min': '1100px', minHeight: 60 } as React.CSSProperties}>
                  <b className="cell-strong ell" style={{ fontSize: 15 }}>{partner}</b>
                  <span className="cell-ell" style={{ fontWeight: 600 }}>{Number(s.month.slice(5))}월{s.month === month ? ' · 진행 중' : ''}</span>
                  <span className="cell-num cell-num--n">{s.contractCount}건</span>
                  <span className="cell-num cell-num--n">{won(s.contractAmount)}원</span>
                  <span className="cell-num cell-num--n">{s.ratePct}%</span>
                  <span className="cell-num">{won(s.fee)}원</span>
                  <span><span className={`chip chip--${chip}`}>{label}</span></span>
                </div>
              );
            })}
          </div>
          <Pager page={page} size={10} total={rows.length} href={(n) => href({ page: String(n) })} />
        </section>
      </div>
    </>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import FilterSelect from '@/components/FilterSelect';
import Pager, { paginate } from '@/components/Pager';
import ListState from '@/components/ListState';
import { requirePerm } from '@/lib/auth';
import { can as can_ } from '@/lib/permissions';
import { ledger, partnerDetail } from '@/lib/partners';
import { today as getToday } from '@/lib/config';
import { CHARGE_CHIP, PAY_MODES, PAY_MODE_NOTE, TAX_CHIP } from '@/lib/constants';
import { md, won } from '@/lib/format';
import { setPayMode } from '../../../actions';

export const metadata = { title: '파트너 · 결제' };
const COLS = '84px minmax(170px,1.5fr) 96px 110px 92px 104px';

/* 시안 3f — 파트너 상세 · 결제 */
export default async function BillingTab({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string; method?: string; page?: string }> }) {
  const user = await requirePerm('파트너 관리');
  const { id } = await params;
  const sp = await searchParams;
  const [d, rows, today] = await Promise.all([partnerDetail(id), ledger(id), getToday()]);
  if (!d) notFound();
  const can = can_(user.role, '파트너 관리');
  const period = sp.period ?? '6';
  const method = sp.method ?? '';
  const from = new Date(today + 'T00:00:00+09:00');
  from.setMonth(from.getMonth() - Number(period));
  const list = rows
    .filter((r) => period === 'all' || new Date(r.billedOn + 'T00:00:00+09:00') >= from)
    .filter((r) => !method || r.method === method);
  const { cur, items } = paginate(list, Number(sp.page), 10);
  const href = (p: number) => `/admin/partners/${id}/billing?${new URLSearchParams({ ...(sp.period ? { period } : {}), ...(method ? { method } : {}), page: String(p) })}`;
  return (
    <div className="grid grid--1-2">
      <section className="card card--pad card--gap14">
        <div className="panel__head"><h3 className="panel__title">결제 방식</h3></div>
        <form action={setPayMode} className="seg">
          <input type="hidden" name="id" value={id} />
          {PAY_MODES.map((m) => <button key={m} name="mode" value={m} className="seg__opt seg__opt--sm" aria-pressed={d.partner.payMode === m} disabled={!can}>{m}</button>)}
        </form>
        <span className="hint" style={{ fontSize: 14, lineHeight: 1.5 }}>{PAY_MODE_NOTE[d.partner.payMode]}</span>
        <div className="fld" style={{ borderTop: '1px solid var(--line2)', paddingTop: 14 }}>
          <span className="fld__label">요금제</span>
          <span style={{ fontSize: 17, fontWeight: 800 }}>{d.plan.name} · 월 {won(d.plan.monthlyFee)}원</span>
          {d.plan.extraNote && <span className="hint" style={{ fontSize: 14 }}>{d.plan.extraNote}</span>}
        </div>
      </section>

      <div className="stack" style={{ gap: 12 }}>
        <div className="filters">
          <span className="filters__label">필터</span>
          <FilterSelect name="period" label="청구 기간" value={period} options={[{ value: '6', label: '최근 6개월' }, { value: '12', label: '최근 12개월' }, { value: 'all', label: '전체' }]} />
          <FilterSelect name="method" label="결제 방식" value={method} options={[{ value: '', label: '전체' }, { value: '계좌 입금', label: '계좌 입금' }, { value: '온라인 결제', label: '온라인 결제' }]} />
          {(sp.period || method) && <Link href={`/admin/partners/${id}/billing`} className="reset-link">초기화</Link>}
        </div>
        <section className="table">
          <div style={{ padding: '18px 20px 6px' }}><h3 className="panel__title">청구 내역</h3></div>
          <div className="table__scroll">
            <div className="table__head" style={{ '--cols': COLS, '--min': '780px' } as React.CSSProperties}>
              <span>청구일</span><span>항목</span><span>결제 방식</span><span style={{ textAlign: 'right' }}>금액</span><span>상태</span><span>세금계산서</span>
            </div>
            {items.map((r) => (
              <div key={r.id} className="table__row" style={{ '--cols': COLS, '--min': '780px', minHeight: 60 } as React.CSSProperties}>
                <span className="cell-txt" style={{ color: 'var(--sub)' }}>{md(r.billedOn)}</span>
                <span className="cell-txt" style={{ color: 'var(--ink)', fontWeight: 700 }}>{r.item}</span>
                <span className="cell-txt">{r.method}</span>
                <span className="num">{won(r.amount)}원</span>
                <span><span className={`chip chip--${CHARGE_CHIP[r.state]}`}>{r.state}</span></span>
                <span><span className={`chip chip--${TAX_CHIP[r.tax]}`}>{r.tax}</span></span>
              </div>
            ))}
          </div>
          {!items.length && <ListState kind="empty" title="청구 내역이 없어요" desc="기간이나 결제 방식을 바꿔 보세요" />}
          <Pager page={cur} size={10} total={list.length} href={href} />
        </section>
      </div>
    </div>
  );
}

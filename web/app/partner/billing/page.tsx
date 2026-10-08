import Link from 'next/link';
import { desc, eq, inArray } from 'drizzle-orm';
import PartnerTop from '@/components/PartnerTop';
import Pager, { paginate } from '@/components/Pager';
import FilterSelect from '@/components/FilterSelect';
import ListState from '@/components/ListState';
import { requirePartner } from '@/lib/auth';
import { getDb, schema as t } from '@/db/client';
import { getSetting } from '@/lib/admin';
import { today } from '@/lib/config';
import { md, won } from '@/lib/format';
import { photoGroups } from '@/lib/partner-app';
import { billMonthly, closeSettlements } from '@/lib/settlement';
import { josa } from '@/lib/text';
import PhotoActions from '../PhotoActions';
import { CopyAccount, PayButton, TaxRequest } from './BillingActions';

export const metadata = { title: '결제 내역' };

export type Billing = { bank: string; account: string; holder: string; dueDay: number };
const ST: Record<string, string> = { '입금 대기': 'warn', '입금 확인': 'ok', '미결제': 'red', '결제 완료': 'ok', '면제': 'gray' };
const KINDS = ['월 관리비', '블로그 초안', '제작비', '정산 수수료'];
const kindOf = (item: string) => KINDS.find((k) => item.startsWith(k)) ?? '기타';
const ym = (d: string) => d.slice(0, 7).replace('-', '.');
type SP = { period?: string; method?: string; kind?: string; page?: string };

/* 시안 2g(데스크톱) · 1g(모바일) — 결제 내역 */
export default async function BillingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePartner();
  const sp = await searchParams;
  const db = await getDb();
  /* 이번 달 월 관리비 · 지난 달 정산 수수료 청구가 아직 없으면 만듦 (매달 1일 청구 — 여러 번 불러도 한 번만) */
  await billMonthly();
  await closeSettlements();
  const [[p], charges, groups, bill, day] = await Promise.all([
    db.select({ partner: t.partners, plan: t.plans }).from(t.partners).innerJoin(t.plans, eq(t.plans.id, t.partners.planId)).where(eq(t.partners.id, user.partnerId)).limit(1),
    db.select().from(t.charges).where(eq(t.charges.partnerId, user.partnerId)).orderBy(desc(t.charges.billedOn)),
    photoGroups(user.partnerId),
    getSetting<Billing>('billing', { bank: '', account: '', holder: '', dueDay: 10 }),
    today()
  ]);
  const taxes = charges.length ? await db.select().from(t.taxRequests).where(inArray(t.taxRequests.chargeId, charges.map((c) => c.id))) : [];
  const taxOf = (id: string) => taxes.find((x) => x.chargeId === id)?.state ?? null;
  const hasBiz = !!(p.partner.bizName && p.partner.taxRegNo && p.partner.taxEmail);
  const newPhotos = groups.reduce((a, g) => a + g.photos.length, 0);

  const month = day.slice(0, 7);
  const thisMonth = charges.filter((c) => c.billedOn.startsWith(month));
  const bank = thisMonth.find((c) => c.method === '계좌 입금');
  const online = thisMonth.find((c) => c.method === '온라인 결제');
  const billed = thisMonth.reduce((a, c) => a + c.amount, 0);
  const due = thisMonth.filter((c) => c.state === '입금 대기' || c.state === '미결제').reduce((a, c) => a + c.amount, 0);
  /* 계약 기간: 종료일이 있으면 그 날, 없으면 시작 달부터 12개월(년 · 월 숫자로 — 시간대에 안 흔들리게) */
  const start = p.partner.startedAt;
  const end = p.partner.endedAt ?? (start ? (() => { const [y, m] = start.split('-').map(Number); const k = y * 12 + (m - 1) + 11; return `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}-01`; })() : null);
  const accountShort = `${bill.bank} ${bill.account.split('-').slice(0, 2).join('-')}-···`;

  /* 지난 내역: 위 두 카드에 나온 건 빼고, 필터 · 페이지 */
  const since = sp.period === 'all' ? '' : sp.period === 'year' ? `${day.slice(0, 4)}-01-01` : new Date(new Date(day).setMonth(new Date(day).getMonth() - 6)).toISOString().slice(0, 10);
  const past = charges.filter((c) => c.id !== bank?.id && c.id !== online?.id)
    .filter((c) => !since || c.billedOn >= since)
    .filter((c) => !sp.method || c.method === sp.method)
    .filter((c) => !sp.kind || kindOf(c.item) === sp.kind);
  const { cur, items } = paginate(past, Number(sp.page), 8);
  const href = (o: Partial<SP>) => {
    const q = new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([k, v]) => v && !(k === 'page' && v === '1')) as [string, string][]);
    return '/partner/billing' + (q.toString() ? '?' + q : '');
  };
  const sub = (c: (typeof charges)[number]) => c.method === '계좌 입금' ? accountShort : c.state === '결제 완료' ? c.payer ?? '카드' : '카드 · 간편결제';
  const receipt = (c: (typeof charges)[number], kind: 'card' | 'tax') => `/partner/billing/${c.id}/receipt?kind=${kind}`;
  const docs = (c: (typeof charges)[number], h: number) => {
    const tax = taxOf(c.id);
    if (c.method === '온라인 결제') {
      return c.state === '미결제' ? <PayButton id={c.id} label="결제하기" height={h} />
        : c.state === '결제 완료' ? <a className="btn-ghost" style={{ height: h }} href={receipt(c, 'card')} download>카드 영수증 다운로드</a> : null;
    }
    return (
      <>
        {!tax && c.state !== '면제' && <TaxRequest id={c.id} hasBiz={hasBiz} height={h} defaults={{ name: p.partner.bizName ?? p.partner.name, reg: p.partner.taxRegNo ?? p.partner.bizRegNo ?? '', email: p.partner.taxEmail ?? p.partner.email ?? '' }} />}
        {tax && <><span className="taxk">세금계산서</span><span className={`taxchip taxchip--${tax === '발행 완료' ? 'ok' : 'warn'}`}>{tax}</span></>}
        {tax === '발행 완료' && <a className="btn-ghost" style={{ height: h, marginLeft: 'auto' }} href={receipt(c, 'tax')} download>다운로드</a>}
      </>
    );
  };

  return (
    <>
      <PartnerTop title="결제 내역" actions={<PhotoActions newPhotos={newPhotos} />} />
      <div className="ppage">
        <div className="grid grid--3 billstats">
          <div className="pcard pstat"><span className="pcard__k">이번 달 청구</span><span className="pstat__n billstats__n">{won(billed)}<small>원</small></span>
            <span className="hint">{thisMonth.map((c) => `${kindOf(c.item)} ${won(c.amount)}`).join(' + ') || '청구 없음'}</span></div>
          <div className="pcard pstat"><span className="pcard__k">납부 기한</span><span className="pstat__n billstats__n">{Number(month.slice(5))}월 {bill.dueDay}일</span>
            <span className="hint">남은 금액 {won(due)}원</span></div>
          <div className="pcard pstat"><span className="pcard__k">월 관리비</span><span className="pstat__n billstats__n">{won(p.plan.monthlyFee)}<small>원</small></span>
            <span className="hint">{start && end ? `계약 기간 ${ym(start)} – ${ym(end)}` : '계약 기간 —'}</span></div>
        </div>

        <div className="billgrid">
          <div className="stack" style={{ gap: 16 }}>
            {bank && (
              <section className="pcard billcard">
                <div className="row" style={{ alignItems: 'center' }}><span className="pcard__title" style={{ flex: 1 }}>계좌 입금</span><span className={`chip chip--${ST[bank.state]}`}>{bank.state}</span></div>
                <div className="billcard__amt"><b>{bank.item}</b><span>{won(bank.amount)}원</span></div>
                <div className="acct">
                  <div><small>입금 계좌</small><b>{bill.bank} {bill.account}</b><small>예금주 {bill.holder} · 입금자명 {p.partner.name}</small></div>
                  <CopyAccount text={`${bill.bank} ${bill.account}`} />
                </div>
                <div className="billcard__docs">{docs(bank, 48)}</div>
              </section>
            )}
            {online && (
              <section className="pcard billcard">
                <div className="row" style={{ alignItems: 'center' }}><span className="pcard__title" style={{ flex: 1 }}>온라인 결제</span><span className={`chip chip--${ST[online.state]}`}>{online.state}</span></div>
                <div className="billcard__amt"><b>{online.item}</b><span>{won(online.amount)}원</span></div>
                {online.state === '미결제' ? (
                  <>
                    <span className="hint" style={{ fontSize: 14 }}>카드 · 간편결제로 바로 결제할 수 있어요</span>
                    <PayButton id={online.id} label={`${won(online.amount)}원 결제하기`} height={56} block />
                  </>
                ) : online.state === '결제 완료' && (
                  <>
                    <span className="hint" style={{ fontSize: 14 }}>{josa(online.payer ?? '카드', '으로')} 결제했어요</span>
                    <a className="btn-ghost" style={{ height: 48 }} href={receipt(online, 'card')} download>카드 영수증 다운로드</a>
                  </>
                )}
              </section>
            )}
            {!bank && !online && <section className="pcard" style={{ padding: 24 }}><b>이번 달 청구가 아직 없어요</b><span className="muted">매달 1일에 청구돼요</span></section>}
          </div>

          <div className="stack" style={{ gap: 12 }}>
            <div className="filters filters--scroll">
              <span className="filters__label only-desk">필터</span>
              <FilterSelect name="period" label="기간" value={sp.period ?? ''} options={[{ value: '', label: '최근 6개월' }, { value: 'year', label: '올해' }, { value: 'all', label: '전체' }]} />
              <FilterSelect name="method" label="결제 방식" value={sp.method ?? ''} options={[{ value: '', label: '전체' }, { value: '계좌 입금', label: '계좌 입금' }, { value: '온라인 결제', label: '온라인 결제' }]} />
              <FilterSelect name="kind" label="항목" value={sp.kind ?? ''} options={[{ value: '', label: '전체' }, ...KINDS.map((k) => ({ value: k, label: k }))]} />
              {(sp.period || sp.method || sp.kind) && <Link href="/partner/billing" className="reset-link">초기화</Link>}
            </div>
            <section className="pcard plist billtable">
              <div className="billtable__title">지난 내역</div>
              <div className="billrow billrow--head only-desk"><span>청구일</span><span>항목</span><span>결제 방식</span><span className="r">금액</span><span>상태</span><span className="r">세금계산서 · 영수증</span></div>
              {!items.length ? <ListState kind="empty" title="조건에 맞는 내역이 없어요" /> : items.map((c) => (
                <div key={c.id} className="billrow">
                  <span className="billrow__date">{md(c.billedOn)}</span>
                  <b className="billrow__item">{c.item}</b>
                  <span className="billrow__m"><b>{c.method}</b><small>{sub(c)}</small></span>
                  <span className="billrow__amt">{won(c.amount)}원</span>
                  <span><span className={`chip chip--${ST[c.state]}`}>{c.state}</span></span>
                  <div className="billrow__docs">{docs(c, 40)}</div>
                </div>
              ))}
              <Pager page={cur} size={8} total={past.length} href={(n) => href({ page: String(n) })} />
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

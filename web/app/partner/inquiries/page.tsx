import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
import PartnerTop from '@/components/PartnerTop';
import Pager, { paginate } from '@/components/Pager';
import FilterSelect from '@/components/FilterSelect';
import ListState from '@/components/ListState';
import { requirePartner } from '@/lib/auth';
import { getDb, schema as t } from '@/db/client';
import { today } from '@/lib/config';
import { rel, won } from '@/lib/format';
import { INQ_ORDER } from '@/lib/partner-app';
import StatusPicker from './StatusPicker';
import ContactButtons from './ContactButtons';

export const metadata = { title: '문의' };

const VER: Record<string, string> = { '확인됨': 'ok', '확인 중': 'warn', '본인 아님': 'red' };
const TABS = ['전체', '신규', '결과 입력 필요'] as const;
const COLS = '88px minmax(110px,1.2fr) minmax(120px,1.3fr) 88px 150px 104px 190px';
type SP = { tab?: string; period?: string; ptype?: string; ver?: string; page?: string };

/* 시안 2d(데스크톱) · 1d(모바일) — 문의 */
export default async function Inquiries({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePartner();
  const sp = await searchParams;
  const db = await getDb();
  const [all, day] = await Promise.all([
    db.select().from(t.inquiries).where(eq(t.inquiries.partnerId, user.partnerId)).orderBy(desc(t.inquiries.receivedAt)),
    today()
  ]);
  const tab = TABS.includes(sp.tab as never) ? sp.tab! : '전체';
  const period = sp.period ?? 'month';
  const month = day.slice(0, 7);
  const ym = (d: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(d).slice(0, 7);
  const prevMonth = (() => { const [y, m] = month.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; })();
  const base = all
    .filter((q) => period === 'all' || ym(q.receivedAt) === (period === 'prev' ? prevMonth : month))
    .filter((q) => !sp.ptype || q.pageType === sp.ptype)
    .filter((q) => !sp.ver || q.verify === sp.ver);
  const rows = base.filter((q) => tab === '전체' || (tab === '신규' ? q.status === '신규' : q.needsResult));
  const { cur, items } = paginate(rows, Number(sp.page), 10);
  const excluded = all.filter((q) => q.verify === '본인 아님').length;
  const href = (o: Partial<SP>) => {
    const v = { ...sp, ...o };
    const p = new URLSearchParams(Object.entries(v).filter(([k, x]) => x && !(k === 'tab' && x === '전체') && !(k === 'page' && x === '1')) as [string, string][]);
    return '/partner/inquiries' + (p.toString() ? '?' + p : '');
  };
  const hasAmt = (q: (typeof all)[number]) => INQ_ORDER.indexOf(q.status as never) >= 3 && (q.amount ?? 0) > 0;
  const isNew = (q: (typeof all)[number]) => q.status === '신규' && q.verify !== '본인 아님';
  const [partner] = await db.select({ name: t.partners.name }).from(t.partners).where(eq(t.partners.id, user.partnerId)).limit(1);
  const sms = (q: (typeof all)[number]) => `[${partner.name}] ${q.customerName ? q.customerName + '님, ' : ''}문의 주셔서 감사합니다. "${q.title}" 관련해 연락드립니다.`;
  const detail = (id: string) => `/partner/inquiries/${id}`;

  return (
    <>
      <PartnerTop title="문의" />
      <div className="ppage">
        <div className="itop">
          <nav className="seg seg--lg" aria-label="문의 구분">
            {TABS.map((x) => (
              <Link key={x} href={href({ tab: x, page: '' })} className="seg__opt" aria-pressed={tab === x}>
                {x}<span className="seg__n">{x === '전체' ? base.length : x === '신규' ? base.filter((q) => q.status === '신규').length : base.filter((q) => q.needsResult).length}</span>
              </Link>
            ))}
          </nav>
          <span className="itop__note">접수되면 고객에게 알림톡으로 본인 확인을 받아요 · 본인 아님 {excluded}건은 홈·통계에서 제외</span>
        </div>
        <div className="filters filters--scroll">
          <span className="filters__label only-desk">필터</span>
          <FilterSelect name="period" label="기간" value={period} options={[{ value: 'month', label: '이번 달' }, { value: 'prev', label: '지난 달' }, { value: 'all', label: '전체' }]} />
          <FilterSelect name="ptype" label="유입 페이지" value={sp.ptype ?? ''} options={[{ value: '', label: '전체' }, ...['현장', '지역', '역 주변', '가이드', '질문'].map((x) => ({ value: x, label: x }))]} />
          <FilterSelect name="ver" label="본인 확인" value={sp.ver ?? ''} options={[{ value: '', label: '전체' }, ...Object.keys(VER).map((x) => ({ value: x, label: x }))]} />
          {(sp.period || sp.ptype || sp.ver) && <Link href={href({ period: '', ptype: '', ver: '', page: '' })} className="reset-link only-desk">초기화</Link>}
        </div>

        {/* 넓은 화면(1280~) 표 · 좁으면 카드 — 칸이 눌려 깨지지 않게 */}
        <div className="table itable iview-table">
          <div className="table__head" style={{ '--cols': COLS, height: 52, fontSize: 14 } as React.CSSProperties}>
            <span>시간</span><span>문의</span><span>유입 페이지</span><span>본인 확인</span><span>상태</span><span style={{ textAlign: 'right' }}>금액</span><span />
          </div>
          {items.map((q, k) => (
            <div key={q.id} className="table__row irow" style={{ '--cols': COLS, opacity: q.verify === '본인 아님' ? 0.45 : 1 } as React.CSSProperties}>
              <span className="irow__time">{rel(q.receivedAt, day)}</span>
              <Link href={detail(q.id)} className="irow__title irow__link">{q.title}</Link>
              <div className="irow__page"><span className="chip chip--plain">{q.pageType}</span><span>{q.pageTitle}</span></div>
              <span><span className={`chip chip--${VER[q.verify]}`}>{q.verify}</span></span>
              <StatusPicker id={q.id} title={q.title} status={q.status} amount={q.amount} needs={q.needsResult} up={k >= items.length - 4 && items.length > 5} />
              <span className="num" style={{ fontSize: 16, color: hasAmt(q) ? 'var(--s4f)' : 'var(--sub3)' }}>{hasAmt(q) ? `${won(q.amount)}원` : '—'}</span>
              <ContactButtons id={q.id} phone={q.customerPhone} smsText={sms(q)} isNew={isNew(q)} detail />
            </div>
          ))}
          {!items.length && <ListState kind="empty" title="조건에 맞는 문의가 없어요" desc="기간이나 필터를 바꿔 보세요" />}
          <Pager page={cur} size={10} total={rows.length} href={(n) => href({ page: String(n) })} />
        </div>

        {/* 1279 이하 카드 (태블릿 2열 · 모바일 1열) */}
        <div className="icards iview-cards">
          <span className="itop__note--m">본인 아님 {excluded}건은 홈·통계에서 제외돼요</span>
          {items.map((q) => (
            <div key={q.id} className={'icard' + (q.needsResult ? ' is-needs' : '')} style={{ opacity: q.verify === '본인 아님' ? 0.45 : 1 }}>
              <div className="icard__top"><span className="irow__time">{rel(q.receivedAt, day)}</span><StatusPicker id={q.id} title={q.title} status={q.status} amount={q.amount} needs={q.needsResult} /></div>
              <div className="icard__mid"><Link href={detail(q.id)} className="irow__link"><b>{q.title}</b></Link>{hasAmt(q) && <span className="icard__amt">계약 {won(q.amount)}원</span>}</div>
              <div className="irow__page"><span className="chip chip--plain">{q.pageType}</span><span>{q.pageTitle}</span></div>
              <div className="icard__bot">
                <span className="hint" style={{ fontWeight: 600 }}>본인 확인</span><span className={`chip chip--${VER[q.verify]}`}>{q.verify}</span>
              </div>
              <div className="icard__acts">
                <ContactButtons id={q.id} phone={q.customerPhone} smsText={sms(q)} isNew={isNew(q)} detail size="m" />
              </div>
            </div>
          ))}
          {!items.length && <ListState kind="empty" title="조건에 맞는 문의가 없어요" />}
          <Pager page={cur} size={10} total={rows.length} href={(n) => href({ page: String(n) })} />
        </div>
      </div>
    </>
  );
}

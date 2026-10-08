import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import PartnerTop from '@/components/PartnerTop';
import { requirePartner } from '@/lib/auth';
import { getDb, schema as t } from '@/db/client';
import { today } from '@/lib/config';
import { hm, md, rel, won } from '@/lib/format';
import { href as siteHref, LIVE } from '@/lib/site';
import { INQ_ORDER } from '@/lib/partner-app';
import StatusPicker from '../StatusPicker';
import ContactButtons from '../ContactButtons';
import MemoForm from './MemoForm';

export const metadata = { title: '문의 자세히' };

const VER: Record<string, [string, string]> = {
  '확인됨': ['ok', '고객이 알림톡에서 본인이 보낸 문의라고 확인했어요'],
  '확인 중': ['warn', '고객에게 알림톡으로 본인 확인을 보냈어요 · 아직 답이 없어요'],
  '본인 아님': ['red', '고객이 본인이 보낸 문의가 아니라고 답했어요 · 홈·통계에서 제외']
};
const KIND: Record<string, string> = { '메모': '메모', '상태': '상태', '전화': '전화', '문자': '문자', '접수': '접수' };

/* 문의 자세히 — 어떻게 들어왔는지(경로 · 페이지 · 본인 확인) · 고객 연락 · 메모 · 진행 기록 */
export default async function InquiryDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePartner();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await getDb();
  const [q] = await db.select().from(t.inquiries).where(and(eq(t.inquiries.id, id), eq(t.inquiries.partnerId, user.partnerId))).limit(1);
  if (!q) notFound();
  const [[partner], [page], logs, day] = await Promise.all([
    db.select({ name: t.partners.name, slug: t.partners.slug }).from(t.partners).where(eq(t.partners.id, user.partnerId)).limit(1),
    q.pageId ? db.select({ path: t.pages.path, status: t.pages.status }).from(t.pages).where(eq(t.pages.id, q.pageId)).limit(1) : Promise.resolve([]),
    db.select({ id: t.inquiryLogs.id, kind: t.inquiryLogs.kind, text: t.inquiryLogs.text, at: t.inquiryLogs.createdAt, who: t.users.name })
      .from(t.inquiryLogs).leftJoin(t.users, eq(t.users.id, t.inquiryLogs.userId))
      .where(eq(t.inquiryLogs.inquiryId, q.id)).orderBy(asc(t.inquiryLogs.createdAt)),
    today()
  ]);
  const pageLink = page?.path && LIVE.includes(page.status) ? siteHref(partner.slug, page.path) : null;
  const sms = `[${partner.name}] ${q.customerName ? q.customerName + '님, ' : ''}문의 주셔서 감사합니다. "${q.title}" 관련해 연락드립니다.`;
  const isNew = q.status === '신규' && q.verify !== '본인 아님';
  const hasAmt = INQ_ORDER.indexOf(q.status as never) >= 3 && (q.amount ?? 0) > 0;
  const timeline = [
    { id: 'recv', kind: '접수', text: q.channel === '전화' ? '전화로 문의가 들어왔어요' : `${q.pageType ?? '사이트'} 페이지 문의 폼으로 접수됐어요`, at: q.receivedAt, who: null as string | null },
    ...logs
  ].reverse();
  const [verKind, verDesc] = VER[q.verify];

  return (
    <>
      <PartnerTop title="문의 자세히" />
      <div className="ppage">
        <Link href="/partner/inquiries" className="back">‹ 문의</Link>
        <div className="ihead">
          <div className="ihead__main">
            <span className="irow__time">{rel(q.receivedAt, day)} 접수</span>
            <h2 className="ihead__title">{q.title}</h2>
            {hasAmt && <span className="icard__amt">계약 {won(q.amount)}원</span>}
          </div>
          <StatusPicker id={q.id} title={q.title} status={q.status} amount={q.amount} needs={q.needsResult} />
        </div>

        <div className="idetail">
          <div className="idetail__col">
            <section className="pcard" aria-labelledby="h-cust">
              <h3 id="h-cust" className="pcard__title">고객</h3>
              <dl className="idl">
                <dt>이름</dt><dd>{q.customerName ?? '—'}</dd>
                <dt>연락처</dt><dd className="num">{q.customerPhone ?? '—'}</dd>
              </dl>
              <ContactButtons id={q.id} phone={q.customerPhone} smsText={sms} isNew={isNew} size="m" />
              <span className="hint">누르면 휴대폰 전화 · 문자 앱이 열리고 진행 기록에 남아요</span>
            </section>

            <section className="pcard" aria-labelledby="h-route">
              <h3 id="h-route" className="pcard__title">문의 경로</h3>
              <dl className="idl">
                <dt>들어온 방법</dt><dd>{q.channel === '전화' ? '사이트 보고 전화' : '사이트 문의 폼'}</dd>
                <dt>유입 페이지</dt>
                <dd className="idl__page">
                  {q.pageType && <span className="chip chip--plain">{q.pageType}</span>}
                  <span>{q.pageTitle ?? '—'}</span>
                  {pageLink && <a href={pageLink} target="_blank" rel="noopener" className="link-accent">페이지 보기 ↗</a>}
                </dd>
                <dt>접수 시간</dt><dd>{md(q.receivedAt)} {hm(q.receivedAt)}</dd>
                <dt>본인 확인</dt><dd><span className={`chip chip--${verKind}`}>{q.verify}</span><span className="hint idl__sub">{verDesc}</span></dd>
              </dl>
            </section>

            <section className="pcard" aria-labelledby="h-body">
              <h3 id="h-body" className="pcard__title">문의 내용</h3>
              {q.body ? <p className="ibody">{q.body}</p> : <p className="hint">{q.channel === '전화' ? '전화로 들어온 문의라 적힌 내용이 없어요 · 통화 내용은 메모로 남겨 주세요' : '적힌 내용이 없어요'}</p>}
            </section>
          </div>

          <div className="idetail__col">
            <section className="pcard" aria-labelledby="h-memo">
              <h3 id="h-memo" className="pcard__title">메모</h3>
              <MemoForm id={q.id} />
            </section>
            <section className="pcard" aria-labelledby="h-log">
              <h3 id="h-log" className="pcard__title">진행 기록</h3>
              <ol className="ilog">
                {timeline.map((l) => (
                  <li key={l.id} className={'ilog__i ilog__i--' + l.kind}>
                    <span className="ilog__kind">{KIND[l.kind]}</span>
                    <div className="ilog__body">
                      <p className="ilog__text">{l.text}</p>
                      <span className="hint">{rel(l.at, day)}{/^오늘|^어제/.test(rel(l.at, day)) ? '' : ` ${hm(l.at)}`}{l.who ? ` · ${l.who}` : ''}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

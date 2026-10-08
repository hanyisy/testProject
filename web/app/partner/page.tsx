import Link from 'next/link';
import PartnerTop from '@/components/PartnerTop';
import PhotoActions from './PhotoActions';
import { requirePartner } from '@/lib/auth';
import { partnerHome } from '@/lib/partner-app';
import { md, won } from '@/lib/format';
import { today } from '@/lib/config';

export const metadata = { title: '홈' };

/* 시안 2a(데스크톱) · 1a(모바일) — 파트너 홈 */
export default async function PartnerHome() {
  const user = await requirePartner();
  const [h, day] = await Promise.all([partnerHome(user.partnerId), today()]);
  const month = Number(day.slice(5, 7));
  return (
    <>
      <PartnerTop
        title="홈"
        mobileTitle={false}
        actions={<PhotoActions newPhotos={h.newPhotos} />}
      />
      <div className="ppage">
        <div className="pgrid pgrid--home">
          <section className="pcard pcard--lg">
            <span className="pcard__k">발행 페이지</span>
            <span className="pbig">{h.pages.total}<small>장</small></span>
            <div className="split" aria-hidden="true">
              <span style={{ flex: h.pages.indexed, background: 'var(--ink)' }} />
              <span style={{ flex: h.pages.waiting, background: 'var(--bar)' }} />
            </div>
            <div className="legend">
              <span><i style={{ background: 'var(--ink)' }} />색인 확인 {h.pages.indexed}장</span>
              <span className="legend--sub"><i style={{ background: 'var(--bar)' }} />대기 {h.pages.waiting}장</span>
            </div>
            <span className="pnote">대부분 {h.indexDays}일 안에 색인이 끝나요</span>
          </section>
          <section className="pcard pcard--lg" style={{ gap: 16 }}>
            <div className="pcard__head"><span className="pcard__title">이번 달 성과</span><span className="pcard__sub">{month}월</span></div>
            <div className="perf">
              <div className="perf__i"><span>검색 유입 문의</span><b>{h.month.inquiries}<small>건</small></b></div>
              <div className="perf__i"><span>계약</span><b>{h.month.contracts}<small>건</small></b></div>
              <div className="perf__i perf__i--amt"><span>계약 금액</span><b>{won(h.month.amount)}<small>원</small></b></div>
            </div>
          </section>
        </div>

        <section className="pcard pcard--lg leak">
          <div className="leak__chart">
            <span className="pcard__title">새는 구간</span>
            <div className="funnel">
              {h.funnel.map((f) => (
                <div key={f.label} className="funnel__row">
                  <span className="funnel__k">{f.label}</span>
                  <div className="funnel__track"><span style={{ width: `${f.pct}%`, background: f.stall ? 'var(--red)' : 'var(--ink)' }} /></div>
                  <span className="funnel__n">{f.n}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="leak__side">
            <Link href="/partner/inquiries" className="alertlink">
              <span className="alertlink__i">!</span><span className="alertlink__t">{h.stall.step} 단계에 {h.stall.n}건이 멈춰 있어요</span><span className="alertlink__go">보기 ›</span>
            </Link>
            {h.needs > 0 && <span className="pnote pnote--desk">견적을 보낸 뒤 결과를 입력하지 않은 건이 {h.needs}건 있어요</span>}
          </div>
        </section>

        <h2 className="psec">할 일</h2>
        <div className="pgrid pgrid--2">
          <Link href="/partner/sites" className="todo2"><span className="todo2__n">{h.newPhotos}</span><span className="todo2__t">새 사진 {h.newPhotos}장 검토 대기</span><span className="chev">›</span></Link>
          <Link href="/partner/inquiries" className="todo2"><span className="todo2__n">{h.needs}</span><span className="todo2__t">문의 {h.needs}건 결과 입력 필요</span><span className="chev">›</span></Link>
        </div>

        <div className="psec psec--row"><h2 className="psec">최근 발행 현장</h2><Link href="/partner/search" className="psec__more">전체 ›</Link></div>
        <div className="sitecards">
          {h.sites.map((s) => (
            <div key={s.id} className="sitecard">
              <div className="ph-img">현장 사진</div>
              <div className="sitecard__body"><span className="sitecard__t">{s.title}</span><span className="sitecard__m">{md(s.workedAt)} · 사진 {s.photoCount}장</span></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import '@/styles/site.css';
import { href, josa, livePages, siteBySlug } from '@/lib/site';

/* 업체 공개 사이트 틀 (시안: 머리 · 바닥 · 모바일 하단 버튼) — 업체마다 대표 색 --brand 하나만 바뀜 */
export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await siteBySlug(slug);
  if (!s) notFound();
  if (s.partner.status === '종료') redirect(`/gone/${slug}`);
  if (s.partner.status !== '운영 중' && !s.canPreview) notFound();
  const pages = await livePages(s.partner.id);
  const guide = pages.find((p) => p.type === '가이드');
  const p = s.partner;
  const nav: [string, string][] = [['시공 사례', '#cases'], ['지역', s.cities[0] ?? ''], ...(guide?.path ? [['가이드', guide.path] as [string, string]] : []), ['문의', '문의']];
  const link = (to: string) => (to.startsWith('#') ? href(slug) + to : href(slug, to));
  return (
    <div className="site" style={{ '--brand': p.brandColor ?? '#2F6B57' } as React.CSSProperties}>
      {p.status !== '운영 중' && <div className="s-preview"><b>미리보기</b>{p.name}는 아직 {p.status}이라 손님에게는 안 보여요 · 본사와 업체만 볼 수 있어요</div>}
      <header className="s-head">
        <div className="s-head__in">
          <Link href={href(slug)} style={{ display: 'contents' }}><span className="s-mark">{p.mark ?? p.name.slice(0, 1)}</span><span className="s-name">{p.name}</span></Link>
          <span className="s-area s-desk">{s.area}</span>
          <nav className="s-nav s-desk" aria-label="사이트 메뉴">{nav.map(([l, to]) => <Link key={l} href={link(to)}>{l}</Link>)}</nav>
          <a href={`tel:${p.tel ?? ''}`} className="s-btn s-desk">{p.tel}</a>
          <a href={`tel:${p.tel ?? ''}`} className="s-tel s-mob">전화</a>
          <details className="s-menu s-mob"><summary aria-label="메뉴"><span /><span /><span /></summary><nav>{nav.map(([l, to]) => <Link key={l} href={link(to)}>{l}</Link>)}</nav></details>
        </div>
      </header>
      <main className="s-main">{children}</main>
      <footer className="s-foot">
        <div className="s-foot__in">
          <div className="s-foot__brand"><span>{p.mark ?? p.name.slice(0, 1)}</span><b>{p.name}</b></div>
          <div className="s-foot__info">
            <span>상호 {p.name}</span>{p.ceo && <span>대표자 {p.ceo}</span>}{p.bizRegNo && <span>사업자등록번호 {p.bizRegNo}</span>}{p.address && <span>주소 {p.address}</span>}{p.tel && <span>전화 {p.tel}</span>}
          </div>
          <div className="s-foot__links"><Link href={href(slug, '개인정보처리방침')}>개인정보처리방침</Link><span>이 사이트의 현장 기록은 {josa(p.name, '이')} 직접 작업한 현장이에요</span></div>
        </div>
      </footer>
      <div className="s-bar"><a href={`tel:${p.tel ?? ''}`}>전화하기</a><a href="#contact">문의 남기기</a></div>
    </div>
  );
}

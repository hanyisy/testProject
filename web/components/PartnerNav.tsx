'use client';
/* 파트너 관리자 공용 틀 (시안 2a · 1a) — 데스크톱: 왼쪽 사이드바 / 모바일: 위 업체명 + 더보기, 아래 탭 5개
 * 메뉴 목록은 PARTNER_MENU 한 곳 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { logout } from '@/app/login/actions';

export const PARTNER_MENU = [
  { href: '/partner', label: '홈' },
  { href: '/partner/sites', label: '현장' },
  { href: '/partner/search', label: '검색 노출' },
  { href: '/partner/inquiries', label: '문의', badge: 'needs' as const },
  { href: '/partner/blog', label: '블로그', lock: true }
];
/** 모바일 머리 제목 (홈은 업체명 · 지역) — 시안 1b~1h */
const MOBILE_TITLES: [string, string][] = [
  ['/partner/sites', '현장 발행'], ['/partner/photos', '사진 추가'], ['/partner/search', '검색 노출'], ['/partner/making', '만들고 있는 페이지'],
  ['/partner/inquiries', '문의'], ['/partner/blog', '블로그'], ['/partner/billing', '결제 내역'], ['/partner/settings', '설정']
];

export const PARTNER_FOOT = [
  { href: '/partner/billing', label: '결제 내역' },
  { href: '/partner/settings', label: '설정' }
];

function Lock() {
  return <span className="lock" aria-label="요금제에 없는 기능"><span /><span /></span>;
}

export default function PartnerNav({ name, area, needs, blogLocked, slug }: { name: string; area: string; needs: number; blogLocked: boolean; slug?: string }) {
  const path = usePathname();
  const on = (href: string) => (href === '/partner' ? path === '/partner' : path === href || path.startsWith(href + '/'));
  const mTitle = MOBILE_TITLES.find(([p]) => path === p || path.startsWith(p + '/'))?.[1];
  const [more, setMore] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setMore(false), [path]);
  useEffect(() => {
    if (!more) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMore(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [more]);

  const item = (m: (typeof PARTNER_MENU)[number] | (typeof PARTNER_FOOT)[number], cls: string) => (
    <Link key={m.href} href={m.href} className={cls} aria-current={on(m.href) ? 'page' : undefined}>
      <span className="pnav__label">{m.label}{'lock' in m && m.lock && blogLocked && <Lock />}</span>
      {'badge' in m && m.badge && needs > 0 && <span className="count">{needs}</span>}
    </Link>
  );

  return (
    <>
      {/* 데스크톱 사이드바 */}
      <nav className="pside" aria-label="파트너 메뉴">
        <div className="pside__brand"><span className="pside__logo">현장로그</span><span className="pside__name">{name}</span></div>
        {PARTNER_MENU.map((m) => item(m, 'pside__link'))}
        <div className="pside__foot">{slug && <a href={`/p/${slug}`} target="_blank" rel="noreferrer" className="pside__link"><span className="pnav__label">내 사이트 보기 ↗</span></a>}{PARTNER_FOOT.map((m) => item(m, 'pside__link'))}</div>
      </nav>

      {/* 모바일 머리: 업체명 · 지역 · 더보기 */}
      <header className="pmhead">
        <div className="pmhead__txt">
          {mTitle ? <span className="pmhead__name">{mTitle}</span> : <><span className="pmhead__name">{name}</span><span className="pmhead__area">{area}</span></>}
        </div>
        <div className="pmhead__more" ref={ref}>
          <button type="button" className="dots" aria-label="더보기" aria-expanded={more} onClick={() => setMore(!more)}><span /><span /><span /></button>
          {more && (
            <div className="menu" role="menu">
              {PARTNER_FOOT.slice().reverse().map((m) => <Link key={m.href} href={m.href} role="menuitem" className="menu__item">{m.label}</Link>)}
              <div className="menu__sep" />
              <form action={logout}><button role="menuitem" className="menu__item menu__item--red">로그아웃</button></form>
            </div>
          )}
        </div>
      </header>

      {/* 모바일 아래 탭 */}
      <nav className="ptabbar" aria-label="파트너 메뉴">
        {PARTNER_MENU.map((m) => (
          <Link key={m.href} href={m.href} className="ptabbar__item" aria-current={on(m.href) ? 'page' : undefined}>
            <span className="ptabbar__bar" />
            <span className="pnav__label">{m.label}{m.lock && blogLocked && <Lock />}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

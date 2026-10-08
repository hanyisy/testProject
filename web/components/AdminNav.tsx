'use client';
/* 본사 어드민 사이드바 (시안 3a) — 지금 화면 표시와 처리할 일 숫자 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavItem = { href: string; label: string; count?: number; sub?: boolean };

export default function AdminNav({ items, foot }: { items: NavItem[]; foot: NavItem[] }) {
  const path = usePathname();
  const active = (href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(href + '/'));
  /* 가장 길게 맞는 주소 하나만 표시 (설정 · 랜딩 관리가 겹치지 않게) */
  const all = [...items, ...foot];
  const current = all.filter((i) => active(i.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const link = (i: NavItem) => (
    <Link key={i.href} href={i.href} className={'side__link' + (i.sub ? ' side__link--sub' : '')} aria-current={i.href === current ? 'page' : undefined}>
      {i.label}
      {!!i.count && <span className="count">{i.count}</span>}
    </Link>
  );
  return (
    <nav className="side" aria-label="본사 메뉴">
      <div className="side__brand"><span className="side__logo">현장로그</span><span className="side__badge">본사</span></div>
      {items.map(link)}
      <div className="side__foot">{foot.map(link)}</div>
    </nav>
  );
}

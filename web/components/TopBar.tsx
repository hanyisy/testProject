/* 어드민 상단 줄 (시안 3a): 화면 이름 · 파트너·페이지 검색 · 내 계정 */
import Link from 'next/link';
import type { SessionUser } from '@/lib/auth';

export default function TopBar({ title, user }: { title: string; user: SessionUser }) {
  return (
    <header className="top">
      <h1 className="top__title">{title}</h1>
      <div className="top__right">
        <form action="/admin/partners" role="search">
          <input className="top__search" name="q" placeholder="파트너·페이지 검색" aria-label="파트너·페이지 검색" />
        </form>
        <Link href="/admin/me" className="top__me">
          <span className="avatar" aria-hidden="true">{user.name.slice(0, 1)}</span>
          <span>{user.role} {user.name}</span>
        </Link>
      </div>
    </header>
  );
}

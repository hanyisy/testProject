'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function PartnerTabs({ id }: { id: string }) {
  const path = usePathname();
  const base = `/admin/partners/${id}`;
  const tabs = [
    [base, '기본 정보'], [`${base}/features`, '기능 스위치'], [`${base}/domain`, '도메인 연결'], [`${base}/billing`, '결제']
  ] as const;
  const cur = path === `${base}/scope` ? `${base}/features` : path;
  return (
    <nav className="ptabs" aria-label="파트너 상세">
      {tabs.map(([href, label]) => <Link key={href} href={href} aria-current={cur === href ? 'page' : undefined}>{label}</Link>)}
    </nav>
  );
}

import AdminNav, { type NavItem } from '@/components/AdminNav';
import { requireStaff } from '@/lib/auth';
import { workCounts } from '@/lib/admin';

/* 본사 어드민 틀 — 로그인한 본사 직원만 (역할별 제한은 각 화면에서) */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const c = await workCounts();
  const items: NavItem[] = [
    { href: '/admin', label: '대시보드' },
    { href: '/admin/leads', label: '가입 문의', count: c.nav.leads },
    { href: '/admin/partners', label: '파트너' },
    { href: '/admin/generate', label: '페이지 생성' },
    { href: '/admin/templates', label: '업종 템플릿' },
    { href: '/admin/plans', label: '요금제' },
    { href: '/admin/indexing', label: '발행·색인' },
    { href: '/admin/review', label: '검수', count: c.nav.review },
    { href: '/admin/jobs', label: '작업 로그', count: c.nav.jobs },
    { href: '/admin/billing', label: '문의·정산', count: c.nav.money },
    { href: '/admin/agency', label: '대행 작업', count: c.nav.agency }
  ];
  const foot: NavItem[] = [
    { href: '/admin/settings', label: '설정' },
    ...(user.role === '최고 관리자' || user.role === '관리팀' ? [{ href: '/admin/settings/landing', label: '랜딩 관리', sub: true }] : [])
  ];
  return (
    <div className="shell">
      <AdminNav items={items} foot={foot} />
      <div className="main">{children}</div>
    </div>
  );
}

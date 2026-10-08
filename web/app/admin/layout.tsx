import AdminNav, { type NavItem } from '@/components/AdminNav';
import { requireStaff } from '@/lib/auth';
import { workCounts } from '@/lib/admin';
import { ADMIN_FOOT, ADMIN_MENU, can } from '@/lib/permissions';

/* 본사 어드민 틀 — 로그인한 본사 직원만. 메뉴는 역할 권한(lib/permissions.ts)에 따라 보임 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const c = await workCounts();
  const items: NavItem[] = ADMIN_MENU.filter((m) => can(user.role, m.perm)).map((m) => ({ href: m.href, label: m.label, count: m.count ? c.nav[m.count] : undefined }));
  const foot: NavItem[] = ADMIN_FOOT.filter((m) => can(user.role, m.perm)).map((m) => ({ href: m.href, label: m.label, sub: m.sub }));
  return (
    <div className="shell">
      <AdminNav items={items} foot={foot} />
      <div className="main">{children}</div>
    </div>
  );
}

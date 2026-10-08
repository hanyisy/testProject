import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { requirePerm } from '@/lib/auth';
import { ADMIN_APP_HOST } from '@/lib/config';
import NewStaffForm from './NewStaffForm';

export const metadata = { title: '직원 추가' };

/* 시안 3z-2 직원 추가 → 3z-3 완료 (최고 관리자만) */
export default async function NewStaffPage() {
  const user = await requirePerm('직원 계정 관리');
  return (
    <>
      <TopBar title="설정" user={user} />
      <div className="page">
        <Link href="/admin/staff" className="back">‹ 설정</Link>
        <NewStaffForm appHost={ADMIN_APP_HOST} />
      </div>
    </>
  );
}

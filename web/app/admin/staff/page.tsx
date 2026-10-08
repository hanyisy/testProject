import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import TopBar from '@/components/TopBar';
import { requireStaff } from '@/lib/auth';
import { can, PERMS } from '@/lib/permissions';
import { getDb, schema as t } from '@/db/client';
import { today } from '@/lib/config';
import { rel } from '@/lib/format';
import { ROLE_CHIP, STAFF_ST } from './shared';

export const metadata = { title: '직원 계정 관리' };

const COLS = 'minmax(0,1fr) minmax(0,1fr) 120px 130px 130px 24px';
const ROLES = ['최고 관리자', '관리팀', '제작 담당'] as const;

/* 시안 3z — 직원 계정 관리 (보는 사람은 로그인한 직원 · 추가는 최고 관리자만) */
export default async function StaffPage() {
  const user = await requireStaff();
  const db = await getDb();
  const [staff, day] = await Promise.all([
    db.select().from(t.users).where(eq(t.users.kind, 'staff')).orderBy(asc(t.users.createdAt)),
    today()
  ]);
  const isSuper = can(user.role, '직원 계정 관리');
  return (
    <>
      <TopBar title="설정" user={user} />
      <div className="page">
        <div className="stack" style={{ gap: 10 }}>
          <Link href="/admin/settings" className="back">‹ 설정</Link>
          <span className="dhead__title">직원 계정 관리</span>
        </div>
        <div className="row" style={{ alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 15, color: 'var(--sub)' }}>직원 {staff.length}명 · 사용 중지 {staff.filter((s) => s.status === '사용 중지').length}명</span>
          {isSuper
            ? <Link href="/admin/staff/new" className="btn-acc" style={{ marginLeft: 'auto', height: 44, padding: '0 20px', fontSize: 15, borderRadius: 12 }}>+ 직원 추가</Link>
            : <span style={{ marginLeft: 'auto', fontSize: 14, color: 'var(--sub2)' }}>직원 추가는 최고 관리자만 할 수 있어요</span>}
        </div>
        <section className="table">
          <div className="table__scroll">
            <div className="table__head" style={{ '--cols': COLS, '--min': '760px' } as React.CSSProperties}><span>이름</span><span>아이디</span><span>역할</span><span>상태</span><span>마지막 로그인</span><span /></div>
            {staff.map((s) => (
              <Link key={s.id} href={`/admin/staff/${s.id}`} className="table__row" style={{ '--cols': COLS, '--min': '760px', minHeight: 60, opacity: s.status === '사용 중지' ? 0.55 : 1 } as React.CSSProperties}>
                <b style={{ fontSize: 15 }}>{s.name}{s.id === user.id && <span className="hint" style={{ marginLeft: 6 }}>나</span>}</b>
                <span className="cell-mono" style={{ color: 'var(--text2)' }}>{s.loginId}</span>
                <span><span className={`chip chip--${ROLE_CHIP[s.role ?? '']}`}>{s.role}</span></span>
                <span><span className={`chip chip--${STAFF_ST[s.status]}`}>{s.status}</span></span>
                <span className="cell-sub">{s.lastLoginAt ? rel(s.lastLoginAt, day) : '—'}</span>
                <span className="chev" aria-hidden="true" style={{ fontSize: 20 }}>›</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="table">
          <div className="tablehead"><h2 className="panel__title">역할별 권한</h2><span className="panel__sub">읽기 전용 · 역할은 직원 상세에서 바꿔요</span></div>
          <div className="permgrid">
            <span />
            {ROLES.map((r) => <span key={r} className="permgrid__h">{r}</span>)}
            {Object.entries(PERMS).filter(([k]) => k !== '모두').map(([label, roles]) => [
              <span key={label} className="permgrid__l">{label}</span>,
              ...ROLES.map((r) => { const on = (roles as readonly string[]).includes(r); return <span key={label + r} className="permgrid__c" style={{ color: on ? 'var(--ink)' : 'var(--sub3)' }}>{on ? '✓' : '—'}</span>; })
            ])}
          </div>
        </section>
      </div>
    </>
  );
}

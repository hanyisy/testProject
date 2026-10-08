import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, count, eq } from 'drizzle-orm';
import TopBar from '@/components/TopBar';
import { requireStaff } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getDb, schema as t } from '@/db/client';
import { today } from '@/lib/config';
import { rel } from '@/lib/format';
import { isUuid } from '@/lib/partners';
import { ROLE_CHIP, STAFF_ST } from '../shared';
import { ActiveToggle, ReissueStaff, RolePick } from './StaffTools';

export const metadata = { title: '직원 상세' };

/* 시안 3z-4 — 직원 상세: 역할 · 임시 비밀번호 다시 만들기 · 사용 중지 (바꾸기는 최고 관리자만) */
export default async function StaffDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = await getDb();
  const [[s], [logs], day] = await Promise.all([
    db.select().from(t.users).where(and(eq(t.users.id, id), eq(t.users.kind, 'staff'))).limit(1),
    db.select({ n: count() }).from(t.auditLogs).where(eq(t.auditLogs.userId, id)),
    today()
  ]);
  if (!s) notFound();
  const edit = can(user.role, '직원 계정 관리');
  const kv: [string, string, boolean?][] = [
    ['아이디', s.loginId, true], ['휴대폰', s.phone ?? '—'], ['이메일', s.email ?? '—'],
    ['마지막 로그인', s.lastLoginAt ? rel(s.lastLoginAt, day) : '—'], ['남긴 작업 기록', `${(s.activityCount + logs.n).toLocaleString('ko-KR')}건`]
  ];
  return (
    <>
      <TopBar title="설정" user={user} />
      <div className="page">
        <div className="stack" style={{ gap: 10 }}>
          <Link href="/admin/staff" className="back">‹ 직원 계정 관리</Link>
          <div className="dhead__row">
            <span className="dhead__title">{s.name}</span>
            <span className={`chip chip--${ROLE_CHIP[s.role ?? '']}`}>{s.role}</span>
            <span className={`chip chip--${STAFF_ST[s.status]}`}>{s.status}</span>
          </div>
        </div>
        {!edit && <div className="infobox infobox--i"><span className="infobox__i">i</span>역할 · 비밀번호 · 계정 상태는 최고 관리자만 바꿀 수 있어요</div>}
        <div className="grid grid--2" style={{ alignItems: 'start' }}>
          <div className="stack">
            <section className="card" style={{ padding: '8px 22px 12px', display: 'flex', flexDirection: 'column' }}>
              {kv.map(([k, v, mono]) => <div key={k} className="kvl"><span className="kvl__k">{k}</span><span className={'kvl__v' + (mono ? ' mono' : '')}>{v}</span></div>)}
            </section>
            <section className="card card--pad card--gap14">
              <div className="panel__head"><h3 className="panel__title">역할</h3></div>
              <RolePick id={s.id} role={s.role ?? '관리팀'} edit={edit} />
              <span className="muted">바꾼 역할은 다음 화면 이동부터 적용돼요</span>
            </section>
          </div>
          <div className="stack">
            <section className="card card--pad card--gap14">
              <div className="panel__head"><h3 className="panel__title">비밀번호</h3></div>
              <span className="hint" style={{ fontSize: 14 }}>현재 비밀번호는 볼 수 없어요</span>
              {edit && <ReissueStaff id={s.id} phone={s.phone ?? ''} loginId={s.loginId} />}
            </section>
            <section className="card card--pad card--gap14">
              <div className="panel__head"><h3 className="panel__title">계정 상태</h3></div>
              <ActiveToggle id={s.id} name={s.name} off={s.status === '사용 중지'} edit={edit && s.id !== user.id} />
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

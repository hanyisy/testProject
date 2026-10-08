import { eq } from 'drizzle-orm';
import TopBar from '@/components/TopBar';
import ThemePick from '@/components/ThemePick';
import { requireStaff } from '@/lib/auth';
import { getDb, schema as t } from '@/db/client';
import { logout } from '@/app/login/actions';
import MyPassword from './MyPassword';

export const metadata = { title: '내 계정' };

/* 시안 3z-5 — 내 계정 (상단 오른쪽 이름을 누르면) */
export default async function MePage() {
  const user = await requireStaff();
  const db = await getDb();
  const [me] = await db.select({ name: t.users.name, loginId: t.users.loginId, role: t.users.role }).from(t.users).where(eq(t.users.id, user.id)).limit(1);
  return (
    <>
      <TopBar title="내 계정" user={user} />
      <div className="page" style={{ maxWidth: 960 }}>
        <span className="dhead__title">내 계정</span>
        <div className="grid grid--2" style={{ alignItems: 'start' }}>
          <div className="stack">
            <section className="card" style={{ padding: '8px 22px 18px', display: 'flex', flexDirection: 'column' }}>
              <div className="kvl"><span className="kvl__k">이름</span><span className="kvl__v">{me.name}</span></div>
              <div className="kvl"><span className="kvl__k">아이디</span><span className="kvl__v mono">{me.loginId}</span></div>
              <div className="kvl"><span className="kvl__k">역할</span><span className="kvl__v">{me.role}</span></div>
              <form action={logout} style={{ paddingTop: 14 }}><button className="btn-ghost btn-ghost--block" style={{ color: 'var(--red)' }}>로그아웃</button></form>
            </section>
            <section className="card card--pad card--gap14">
              <div className="panel__head"><h3 className="panel__title">화면 테마</h3><span className="panel__sub">이 브라우저에 기억돼요</span></div>
              <ThemePick />
            </section>
          </div>
          <MyPassword />
        </div>
      </div>
    </>
  );
}

/* 컨펌용 데모 계정 — 누가 로그인했는지에 따라 메뉴와 데이터가 어떻게 달라지는지 바로 확인 (DEMO_LOGIN=off 로 숨김) */
import { asc, desc, eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { demoLogin } from './actions';

export default async function DemoAccounts({ next }: { next: string }) {
  const db = await getDb();
  const users = await db.select({ loginId: t.users.loginId, name: t.users.name, kind: t.users.kind, role: t.users.role, status: t.users.status, partner: t.partners.name })
    .from(t.users).leftJoin(t.partners, eq(t.partners.id, t.users.partnerId))
    .orderBy(desc(t.users.kind), asc(t.users.createdAt));
  return (
    <section className="demo" aria-labelledby="demo-h">
      <div className="demo__head"><strong id="demo-h">데모 계정으로 보기</strong><span>컨펌용 · 비밀번호 없이 들어가요</span></div>
      <form action={demoLogin} className="demo__list">
        <input type="hidden" name="next" value={next} />
        {users.map((u) => (
          <button key={u.loginId} name="id" value={u.loginId} className="demo__btn">
            <b>{u.kind === 'partner' ? u.partner : u.name}</b>
            <small>{u.kind === 'partner' ? '파트너' : u.role} · {u.loginId}{u.status !== '사용 중' ? ` · ${u.status}` : ''}</small>
          </button>
        ))}
      </form>
    </section>
  );
}

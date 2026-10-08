/* 컨펌용 데모 계정 — 본사 · 파트너를 나눠 보여 주고, 누르면 그 계정으로 바로 들어감 (DEMO_LOGIN=off 로 숨김) */
import { asc, eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { demoLogin } from './actions';

export default async function DemoAccounts({ next }: { next: string }) {
  const db = await getDb();
  const users = await db.select({ loginId: t.users.loginId, name: t.users.name, kind: t.users.kind, role: t.users.role, status: t.users.status, partner: t.partners.name })
    .from(t.users).leftJoin(t.partners, eq(t.partners.id, t.users.partnerId))
    .orderBy(asc(t.users.createdAt));
  const groups = [
    { title: '본사', chip: 'info', desc: '본사 어드민으로 들어가요', list: users.filter((u) => u.kind === 'staff') },
    { title: '파트너', chip: 'ok', desc: '파트너 관리자로 들어가요', list: users.filter((u) => u.kind === 'partner') }
  ];
  return (
    <section className="demo" aria-labelledby="demo-h">
      <div className="demo__head"><strong id="demo-h">데모 계정으로 보기</strong><span>컨펌용 · 비밀번호 없이 들어가요</span></div>
      <form action={demoLogin} className="demo__groups">
        <input type="hidden" name="next" value={next} />
        {groups.map((g) => (
          <div key={g.title} className="demo__group">
            <div className="demo__gh"><span className={`chip chip--${g.chip}`}>{g.title}</span><small>{g.desc}</small></div>
            <div className="demo__list">
              {g.list.map((u) => (
                <button key={u.loginId} name="id" value={u.loginId} className="demo__btn">
                  <b>{u.kind === 'partner' ? u.partner : u.name}</b>
                  <small>{u.kind === 'partner' ? u.loginId : `${u.role} · ${u.loginId}`}{u.status !== '사용 중' ? ` · ${u.status}` : ''}</small>
                </button>
              ))}
            </div>
          </div>
        ))}
      </form>
    </section>
  );
}

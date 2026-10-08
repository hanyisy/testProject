import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { requireStaff } from '@/lib/auth';
import { dashboard } from '@/lib/admin';
import { can } from '@/lib/permissions';

export const metadata = { title: '대시보드' };

/* 시안 3a — 대시보드 */
export default async function Dashboard() {
  const user = await requireStaff();
  const d = await dashboard();
  return (
    <>
      <TopBar title="대시보드" user={user} />
      <div className="page">
        <div className="grid grid--4">
          {d.stats.map((s) => (
            <div key={s.label} className="stat">
              <span className="stat__label">{s.label}</span>
              <span className="stat__num">{s.num}<small>{s.unit}</small></span>
              <span className="stat__note">{s.note}</span>
            </div>
          ))}
        </div>
        <div className="grid grid--2-12">
          <section className="panel" aria-labelledby="todo-h">
            <div className="panel__head"><h2 className="panel__title" id="todo-h">처리할 일</h2></div>
            <div className="gap8" />
            {d.todos.filter((t) => can(user.role, t.perm) && !('optional' in t && t.optional && !t.n)).map((t) => (
              <Link key={t.label} href={t.href} className="todo">
                <span className={'todo__n' + (t.n === 0 ? ' is-zero' : t.alert ? ' is-alert' : '')}>{t.n}</span>
                <span className="todo__label">{t.label}</span>
                <span className="todo__sub">{t.sub}</span>
                <span className="chev" aria-hidden="true">›</span>
              </Link>
            ))}
          </section>
          <section className="panel" aria-labelledby="watch-h">
            <div className="panel__head">
              <h2 className="panel__title" id="watch-h">주의가 필요한 파트너</h2>
              <span className="panel__sub">색인 비율 하락 · 2주 이상 현장 없음</span>
            </div>
            <div className="gap8" />
            {d.attention.map((a) => (
              <Link key={a.partner + a.tag} href={a.to === 'indexing' ? '/admin/indexing' : '/admin/partners'} className="watch">
                <div className="watch__txt">
                  <span className="watch__name">{a.partner}<span className="chip chip--red">{a.tag}</span></span>
                  <span className="watch__desc">{a.desc}</span>
                </div>
                <span className="watch__val">{a.value}</span>
                <span className="chev" aria-hidden="true">›</span>
              </Link>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}

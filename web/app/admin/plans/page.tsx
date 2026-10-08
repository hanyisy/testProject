import { asc, ne } from 'drizzle-orm';
import TopBar from '@/components/TopBar';
import { requireStaff } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getDb, schema as t } from '@/db/client';
import { addPlan } from './actions';
import PlanCard from './PlanCard';

export const metadata = { title: '요금제' };

/* 시안 3i — 요금제: 포함 기능은 새 파트너 기능 스위치의 기본값 (편집은 최고 관리자) */
export default async function PlansPage() {
  const user = await requireStaff();
  const db = await getDb();
  const [plans, partners] = await Promise.all([
    db.select().from(t.plans).orderBy(asc(t.plans.sort)),
    db.select({ planId: t.partners.planId }).from(t.partners).where(ne(t.partners.status, '종료'))
  ]);
  const edit = can(user.role, '요금제 편집');
  return (
    <>
      <TopBar title="요금제" user={user} />
      <div className="page">
        <div className="row" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, color: 'var(--sub)' }}>요금제의 포함 기능은 새 파트너의 기능 스위치 기본값이 돼요</span>
          <span className="chip chip--warn">금액은 임시값</span>
          {edit
            ? <form action={addPlan} style={{ marginLeft: 'auto' }}><button className="btn-ghost btn-ghost--sm">+ 요금제 추가</button></form>
            : <span className="hint" style={{ marginLeft: 'auto' }}>편집은 최고 관리자만 할 수 있어요</span>}
        </div>
        <div className="grid grid--3" style={{ alignItems: 'start' }}>
          {plans.map((p) => (
            <PlanCard key={p.id} edit={edit} users={partners.filter((x) => x.planId === p.id).length}
              plan={{ id: p.id, name: p.name, setupFee: p.setupFee, monthlyFee: p.monthlyFee, extra: p.extraNote, features: p.defaultFeatures }} />
          ))}
        </div>
      </div>
    </>
  );
}

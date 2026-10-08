'use client';
/* 요금제 카드 (3i): 기능 값을 누르면 바뀜 → 저장 */
import { useState, useTransition } from 'react';
import { BLOG_MODES, FEATURES } from '@/lib/constants';
import type { Features } from '@/db/schema';
import { savePlan } from './actions';

type Plan = { id: string; name: string; setupFee: number; monthlyFee: number; extra: string; features: Features };
const fmt = (n: number) => n.toLocaleString('ko-KR');
const num = (v: string) => Number(v.replace(/[^0-9]/g, '')) || 0;

export default function PlanCard({ plan, users, edit }: { plan: Plan; users: number; edit: boolean }) {
  const [p, setP] = useState(plan);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const up = (o: Partial<Plan>) => { setP({ ...p, ...o }); setMsg(null); };
  const dirty = JSON.stringify(p) !== JSON.stringify(plan);
  return (
    <section className="panel plancard">
      <div className="row" style={{ alignItems: 'center' }}>
        <input className="plancard__name" value={p.name} onChange={(e) => up({ name: e.target.value })} readOnly={!edit} aria-label="요금제 이름" />
        <span className="hint" style={{ fontWeight: 700 }}>사용 {users}곳</span>
      </div>
      <div className="grid grid--2" style={{ gap: 10 }}>
        {([['setupFee', '제작비'], ['monthlyFee', '월 관리비']] as const).map(([k, label]) => (
          <label key={k} className="fld"><span className="fld__label">{label}</span>
            <span className="wonin"><input value={fmt(p[k])} onChange={(e) => up({ [k]: num(e.target.value) })} readOnly={!edit} inputMode="numeric" /><span>원</span></span>
          </label>
        ))}
      </div>
      <span className="hint" style={{ minHeight: 18 }}>{p.extra}</span>
      <div className="stack" style={{ gap: 0 }}>
        <span className="fld__label">포함 기능 · 기본값</span>
        <div style={{ height: 6 }} />
        {FEATURES.map(({ key, label }) => {
          const v = p.features[key];
          const on = key === 'blog' ? v !== '꺼짐' : !!v;
          const next = () => up({ features: { ...p.features, [key]: key === 'blog' ? BLOG_MODES[(BLOG_MODES.indexOf(v as (typeof BLOG_MODES)[number]) + 1) % 3] : !v } });
          return (
            <div key={key} className="planfeat">
              <span>{label}</span>
              <button type="button" className={'planfeat__v' + (on ? ' is-on' : '')} onClick={next} disabled={!edit}>{key === 'blog' ? String(v) : on ? '켜짐' : '꺼짐'}</button>
            </div>
          );
        })}
      </div>
      {edit && (
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <button type="button" className="btn-ink" style={{ flex: 1, height: 44 }} disabled={pending || !dirty}
            onClick={() => start(async () => {
              const r = await savePlan(p.id, { name: p.name, setupFee: p.setupFee, monthlyFee: p.monthlyFee, features: p.features });
              setMsg(r.ok ? '저장됐어요' : r.error);
            })}>저장</button>
          {msg && <span style={{ fontSize: 14, fontWeight: 700, color: msg === '저장됐어요' ? 'var(--s4f)' : 'var(--red)' }}>{msg}</span>}
        </div>
      )}
    </section>
  );
}

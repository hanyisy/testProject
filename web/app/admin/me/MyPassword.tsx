'use client';
/* 내 비밀번호 바꾸기 (3z-5) — 지금 비밀번호 확인 · 조건 표시 */
import { useState, useTransition } from 'react';
import { changeMyPassword } from '@/lib/account-actions';

export default function MyPassword() {
  const [old, setOld] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pending, start] = useTransition();
  const rules = [['8자 이상', pw.length >= 8], ['영문과 숫자 함께', /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw)], ['두 칸이 같아요', !!pw2 && pw === pw2]] as const;
  const can = !!old && rules.every(([, ok]) => ok);
  return (
    <form className="card card--pad card--gap14" onSubmit={(e) => {
      e.preventDefault();
      start(async () => { const r = await changeMyPassword(old, pw, pw2); setMsg(r.ok ? { ok: true, t: '바꿨어요 · 다른 기기에서는 다시 로그인해야 해요' } : { ok: false, t: r.error }); if (r.ok) { setOld(''); setPw(''); setPw2(''); } });
    }}>
      <div className="panel__head"><h3 className="panel__title">비밀번호 변경</h3></div>
      <label className="fld"><span className="fld__label">지금 비밀번호</span><input className="fld__input" type="password" autoComplete="current-password" value={old} onChange={(e) => { setOld(e.target.value); setMsg(null); }} /></label>
      <label className="fld"><span className="fld__label">새 비밀번호</span><input className="fld__input" type="password" autoComplete="new-password" placeholder="8자 이상 · 영문과 숫자" value={pw} onChange={(e) => { setPw(e.target.value); setMsg(null); }} /></label>
      <label className="fld"><span className="fld__label">한 번 더 입력</span><input className="fld__input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); setMsg(null); }} /></label>
      <div className="pwrules">{rules.map(([t, ok]) => <span key={t} className={ok ? 'is-ok' : ''}><span>✓</span>{t}</span>)}</div>
      <div className="row" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn-ink" style={{ height: 46, padding: '0 22px' }} disabled={!can || pending}>바꾸기</button>
        {msg && <span style={{ fontSize: 14, fontWeight: 700, color: msg.ok ? 'var(--s4f)' : 'var(--red)' }}>{msg.t}</span>}
      </div>
    </form>
  );
}

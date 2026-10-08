'use client';
/* 설정 (3n) 입력: − / + 는 바로 저장, 숫자 칸 · 연동 값은 칸을 벗어나면 저장 */
import { useState, useTransition } from 'react';
import { setIntegration, setNumber, type NumKey } from './actions';

export function Stepper({ k, value, unit, base, edit, step = 1, big, p90 }: { k: NumKey; value: number; unit: string; base: string; edit: boolean; step?: number; big?: boolean; p90?: number }) {
  const [v, setV] = useState(value);
  const [pending, start] = useTransition();
  const go = (d: number) => start(async () => { const r = await setNumber(k, v + d); if (r.ok) setV(r.value); });
  return (
    <>
      <div className="stepper3">
        <button type="button" onClick={() => go(-step)} disabled={!edit || pending} aria-label="줄이기">−</button>
        <b className={big ? 'is-big' : ''}>{v}<small>{unit}</small></b>
        <button type="button" onClick={() => go(step)} disabled={!edit || pending} aria-label="늘리기">+</button>
        <span className="muted" style={{ marginLeft: 'auto' }}>{base}</span>
      </div>
      {p90 !== undefined && (
        <>
          <div className="surfbox"><small>파트너 홈 미리보기</small><span>대부분 {v}일 안에 색인이 끝나요</span></div>
          {/* 실측 90% 기준일보다 짧게 안내하면 경고 */}
          <span style={{ fontSize: 13, fontWeight: 600, color: v < p90 ? 'var(--red)' : 'var(--s4f)' }}>{v < p90 ? `실측 기준 ${v}일 안 색인은 90%보다 낮아요` : `실측 기준 90% 이상이 ${v}일 안에 색인돼요`}</span>
        </>
      )}
    </>
  );
}

export function NumInput({ k, label, value, placeholder, edit }: { k: NumKey; label: string; value: number; placeholder: string; edit: boolean }) {
  const [v, setV] = useState(String(value));
  const [saved, setSaved] = useState(false);
  return (
    <label className="fld"><span className="fld__label">{label}{saved && <span className="okline" style={{ marginLeft: 8, fontSize: 12 }}>저장됨</span>}</span>
      <input className="fld__input" inputMode="numeric" value={v} placeholder={placeholder} readOnly={!edit}
        onChange={(e) => { setV(e.target.value.replace(/\D/g, '')); setSaved(false); }}
        onBlur={async () => { if (!edit || !v || Number(v) === value) return; const r = await setNumber(k, Number(v)); if (r.ok) { setV(String(r.value)); setSaved(true); } }} />
    </label>
  );
}

type Row = { k: 'payment_key' | 'alim1' | 'alim2'; label: string; sub: string; ph: string; shown: string; set: boolean };

export function Integrations({ rows, edit }: { rows: Row[]; edit: boolean }) {
  return <>{rows.map((r) => <IntRow key={r.k} r={r} edit={edit} />)}</>;
}

function IntRow({ r, edit }: { r: Row; edit: boolean }) {
  const [v, setV] = useState(r.k === 'payment_key' ? '' : r.shown);
  const [isSet, setIsSet] = useState(r.set);
  const [err, setErr] = useState('');
  const secret = r.k === 'payment_key';
  const save = async () => {
    if (!edit) return;
    if (secret && !v) return; // 비밀 값은 새로 입력할 때만 바꿈
    if (!secret && v === r.shown) return;
    const res = await setIntegration(r.k, v);
    if (res.ok) { setErr(''); setIsSet(!!v); if (secret) setV(''); } else setErr(res.error);
  };
  return (
    <div className="introw">
      <div className="stack" style={{ gap: 2 }}><b style={{ fontSize: 15 }}>{r.label}</b><small className="muted" style={{ fontSize: 12 }}>{r.sub}</small></div>
      <div className="stack" style={{ gap: 4 }}>
        <input className="fld__input fld__input--mono" style={{ height: 44, fontSize: 14 }} value={v} readOnly={!edit} type={secret ? 'password' : 'text'} autoComplete="off"
          placeholder={secret && isSet ? `저장됨 ${r.shown} · 바꾸려면 새로 입력` : r.ph} onChange={(e) => setV(e.target.value.trim())} onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} aria-label={r.label} />
        {err && <span className="pubhint" style={{ margin: 0, textAlign: 'left' }}>{err}</span>}
        {secret && isSet && edit && <button type="button" className="linkbtn linkbtn--red" style={{ alignSelf: 'flex-start', fontSize: 12 }} onClick={async () => { const res = await setIntegration('payment_key', ''); if (res.ok) setIsSet(false); }}>결제 키 지우기</button>}
      </div>
      <span><span className={`chip chip--${isSet ? 'ok' : 'warn'}`}>{isSet ? '연결됨' : '승인 대기 중'}</span></span>
    </div>
  );
}

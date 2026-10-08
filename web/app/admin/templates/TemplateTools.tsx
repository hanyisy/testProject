'use client';
/* 업종 템플릿 (3h) 버튼들: 새 업종 · 코드 변경/삭제(잠김 안내) · 상태 · 항목 편집 */
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type ReactNode } from 'react';
import { addIndustry, addItem, changeCode, deleteIndustry, removeItem, setIndustryStatus } from './actions';

export function NewIndustry() {
  const ref = useRef<HTMLDialogElement>(null);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className="btn-ghost btn-ghost--xs" onClick={() => { setErr(''); ref.current?.showModal(); }}>+ 새 업종</button>
      <dialog ref={ref} className="modal" aria-labelledby="new-ind" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <form className="modal__card" style={{ width: 440 }} action={(fd) => start(async () => { const r = await addIndustry(fd); if (r && !r.ok) setErr(r.error); })}>
          <span className="modal__title" id="new-ind">새 업종</span>
          <label className="fld"><span className="fld__label">업종명</span><input className="fld__input fld__input--lg" name="name" placeholder="예) 방수 공사" required /></label>
          <label className="fld"><span className="fld__label">코드</span><input className="fld__input fld__input--lg fld__input--mono" name="code" placeholder="예) waterproof" required pattern="[a-z][a-z0-9-]{1,30}" />
            <span className="hint">영문 소문자 · 숫자 · - · 페이지 주소와 데이터에 쓰여요</span></label>
          {err && <span className="pubhint" style={{ margin: 0, textAlign: 'left' }}>{err}</span>}
          <div className="row"><button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => ref.current?.close()}>취소</button><button className="btn-ink" style={{ flex: 2 }} disabled={pending}>추가</button></div>
        </form>
      </dialog>
    </>
  );
}

export function CodeAndDelete({ id, name, code, active, ended, chip }: { id: string; name: string; code: string; active: number; ended: number; chip: ReactNode }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ t: string; red: boolean } | null>(null);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(code);
  const [pending, start] = useTransition();
  const del = useRef<HTMLDialogElement>(null);
  const locked = active > 0;
  const lockMsg = `활성 파트너 ${active}곳이 사용 중이라 변경할 수 없어요`;
  return (
    <>
      <div className="row" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 22, fontWeight: 800 }}>{name}</span>
        {editing
          ? <form className="row" style={{ gap: 6 }} onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await changeCode(id, val); if (r.ok) { setEditing(false); router.replace(`/admin/templates?i=${r.code}`, { scroll: false }); } else setMsg({ t: r.error, red: true }); }); }}>
              <input className="fld__input fld__input--mono" style={{ height: 38, width: 170 }} value={val} onChange={(e) => setVal(e.target.value.toLowerCase())} aria-label="새 코드" autoFocus />
              <button className="btn-ink btn-ink--sm" disabled={pending}>저장</button>
              <button type="button" className="btn-ghost btn-ghost--xs" onClick={() => { setEditing(false); setVal(code); }}>취소</button>
            </form>
          : <span className="cell-mono" style={{ color: 'var(--sub)' }}>{code}</span>}
        {chip}
        <div className="row" style={{ marginLeft: 'auto', gap: 8 }}>
          <button type="button" className={'tplbtn' + (locked ? ' is-locked' : '')} onClick={() => locked ? setMsg({ t: lockMsg, red: true }) : (setMsg(null), setEditing(true))}>{locked ? '잠김 · ' : ''}코드 변경</button>
          <button type="button" className={'tplbtn tplbtn--red' + (locked ? ' is-locked' : '')} onClick={() => locked ? setMsg({ t: lockMsg, red: true }) : del.current?.showModal()}>{locked ? '잠김 · ' : ''}삭제</button>
        </div>
      </div>
      {msg && <div className={msg.red ? 'redbox' : 'okbox'}>{msg.t}</div>}
      <dialog ref={del} className="modal" aria-labelledby="del-ind" onClick={(e) => { if (e.target === del.current) del.current?.close(); }}>
        <div className="modal__card" style={{ width: 440 }}>
          <div className="modal__head"><span className="modal__icon" aria-hidden="true">!</span><span className="modal__title" id="del-ind">{name} 업종을 {ended ? '보관할까요?' : '삭제할까요?'}</span></div>
          <span className="modal__text">{ended ? `종료된 파트너 ${ended}곳의 기록이 남아 있어 지우지 않고 보관해요. 새 파트너 등록에서 빠져요.` : '템플릿 항목도 함께 지워져요. 되돌릴 수 없어요.'}</span>
          <div className="row">
            <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => del.current?.close()}>취소</button>
            <button type="button" className="btn-ink" style={{ flex: 2, background: 'var(--red)' }} disabled={pending}
              onClick={() => start(async () => { const r = await deleteIndustry(id); del.current?.close(); if (r && !r.ok) setMsg({ t: r.error, red: true }); else if (r?.archived) setMsg({ t: '보관했어요', red: false }); })}>{ended ? '보관' : '삭제'}</button>
          </div>
        </div>
      </dialog>
    </>
  );
}

export function StatusPick({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="row" style={{ alignItems: 'center', gap: 10 }}>
      <span className="fld__label">상태</span>
      <div className="seg">
        {(['사용 가능', '신규 중지', '보관'] as const).map((s) => (
          <button key={s} type="button" className="seg__opt seg__opt--sm" aria-pressed={status === s} disabled={pending} onClick={() => start(() => setIndustryStatus(id, s))}>{s}</button>
        ))}
      </div>
    </div>
  );
}

export function GroupItems({ id, group, items }: { id: string; group: (typeof import('@/lib/constants').TEMPLATE_GROUPS)[number]; items: { id: string; label: string }[] }) {
  const [val, setVal] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="fld__label">{group}</span>
      <div className="tags" style={{ gap: 6 }}>
        {items.map((i) => (
          <span key={i.id} className="tplitem">{i.label}<button type="button" aria-label={`${i.label} 빼기`} disabled={pending} onClick={() => start(() => removeItem(i.id))}>×</button></span>
        ))}
        <form className="tplitem tplitem--add" onSubmit={(e) => { e.preventDefault(); if (!val.trim()) return; start(async () => { await addItem(id, group, val); setVal(''); }); }}>
          <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="+ 추가" aria-label={`${group} 추가`} />
        </form>
      </div>
    </div>
  );
}

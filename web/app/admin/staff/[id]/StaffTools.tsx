'use client';
/* 직원 상세 (3z-4) 버튼들 */
import { useRef, useState, useTransition } from 'react';
import type { Role } from '@/lib/auth';
import { reissueStaffPassword, sendStaffSms, setStaffActive, setStaffRole } from '../actions';

const ROLES: Role[] = ['최고 관리자', '관리팀', '제작 담당'];

export function RolePick({ id, role, edit }: { id: string; role: Role; edit: boolean }) {
  const [r, setR] = useState(role);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  return (
    <>
      <div className="seg seg--w420">
        {ROLES.map((x) => (
          <button key={x} type="button" className="seg__opt" aria-pressed={r === x} disabled={!edit || pending}
            onClick={() => start(async () => { setErr(''); const res = await setStaffRole(id, x); if (res.ok) setR(x); else setErr(res.error); })}>{x}</button>
        ))}
      </div>
      {err && <span className="pubhint" style={{ margin: 0, textAlign: 'left' }}>{err}</span>}
    </>
  );
}

export function ReissueStaff({ id, phone, loginId }: { id: string; phone: string; loginId: string }) {
  const [pw, setPw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  if (!pw) return <button type="button" className="btn-ghost btn-ghost--block" disabled={pending} onClick={() => start(async () => { const r = await reissueStaffPassword(id); if (r.ok) setPw(r.pw); })}>임시 비밀번호 다시 만들어 전달하기</button>;
  return (
    <div className="box-surf box-surf--pad">
      <span className="hint" style={{ fontWeight: 700, fontSize: 14 }}>새 임시 비밀번호 · 이 화면에서만 보여요</span>
      <span className="pw-big">{pw}</span>
      <div className="row">
        <button type="button" className="btn-ghost btn-ghost--sm" style={{ flex: 1 }}
          onClick={() => { navigator.clipboard?.writeText(`[현장로그] 아이디 ${loginId} · 임시 비밀번호 ${pw} · 처음 로그인하면 새 비밀번호를 정해 주세요.`).catch(() => {}); setCopied(true); }}>{copied ? '복사됐어요' : '복사'}</button>
        <button type="button" className="btn-blue" style={{ flex: 1.3, height: 40 }} disabled={sent || !phone} onClick={async () => { await sendStaffSms(id, '임시 비밀번호'); setSent(true); }}>문자 보내기</button>
      </div>
      {sent && <span className="okline">{phone}으로 보냈어요</span>}
    </div>
  );
}

export function ActiveToggle({ id, name, off, edit }: { id: string; name: string; off: boolean; edit: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  const run = (active: boolean) => start(async () => { setErr(''); const r = await setStaffActive(id, active); ref.current?.close(); if (!r.ok) setErr(r.error); });
  return (
    <>
      {off ? (
        <div className="row" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="hint" style={{ fontSize: 14, flex: 1 }}>사용 중지된 계정이에요 · 작업 기록은 남아 있어요</span>
          {edit && <button type="button" className="btn-ink btn-ink--sm" disabled={pending} onClick={() => run(true)}>다시 사용하기</button>}
        </div>
      ) : (
        <div className="row" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="hint" style={{ fontSize: 14, flex: 1 }}>사용 중지하면 로그인이 막혀요. 삭제는 할 수 없어요</span>
          {edit && <button type="button" className="btn-ghost btn-ghost--sm" style={{ color: 'var(--red)' }} onClick={() => ref.current?.showModal()}>사용 중지</button>}
        </div>
      )}
      {err && <span className="pubhint" style={{ margin: 0, textAlign: 'left' }}>{err}</span>}
      <dialog ref={ref} className="modal" aria-labelledby="off-h" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <div className="modal__card" style={{ width: 440 }}>
          <div className="modal__head"><span className="modal__icon" aria-hidden="true">!</span><span className="modal__title" id="off-h">{name} 계정을 사용 중지할까요?</span></div>
          <span className="modal__text">로그인이 막히고, 이 직원이 남긴 작업 기록은 그대로 남아요.</span>
          <div className="row">
            <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => ref.current?.close()}>취소</button>
            <button type="button" className="btn-ink" style={{ flex: 2, background: 'var(--red)' }} disabled={pending} onClick={() => run(false)}>사용 중지</button>
          </div>
        </div>
      </dialog>
    </>
  );
}

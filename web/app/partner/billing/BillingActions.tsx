'use client';
/* 결제 내역 버튼들 (2g): 계좌 복사 · 온라인 결제 · 세금계산서 발행 요청(+사업자 정보 입력 창) */
import { useRef, useState, useTransition } from 'react';
import { payOnline, requestTax, saveBizAndRequest, type Biz } from './actions';

export function CopyAccount({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn-ghost" style={{ height: 44 }}
      onClick={async () => { try { await navigator.clipboard.writeText(text); } catch { /* 권한 없음 */ } setDone(true); }}>
      {done ? '복사됨' : '복사'}
    </button>
  );
}

export function PayButton({ id, label, height, block }: { id: string; label: string; height: number; block?: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  return (
    <>
      <button type="button" className={'pbtn pbtn--accent' + (block ? ' pbtn--xl' : '')} style={{ height, fontSize: block ? 17 : 15 }} disabled={pending}
        onClick={() => start(async () => { setErr(''); const r = await payOnline(id); if (!r.ok) setErr(r.error); })}>
        {pending ? '결제하는 중…' : label}
      </button>
      {err && <span className="pubhint" style={{ margin: 0 }}>{err}</span>}
    </>
  );
}

/** 사업자등록번호 000-00-00000 */
export const fmtReg = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 10);
  return d.length > 5 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
};
export const bizOk = (f: Biz) => !!(f.name.trim() && f.reg.replace(/\D/g, '').length === 10 && /.+@.+\..+/.test(f.email));

/** 상호 · 사업자등록번호 · 담당자 이메일 (요청 창 · 설정 공용) */
export function BizFields({ f, set }: { f: Biz; set: (f: Biz) => void }) {
  return (
    <>
      <label className="fld"><span className="fld__label">상호</span><input className="fld__input fld__input--lg" value={f.name} onChange={(e) => set({ ...f, name: e.target.value })} placeholder="예) 한결철거" /></label>
      <label className="fld"><span className="fld__label">사업자등록번호</span><input className="fld__input fld__input--lg" value={f.reg} onChange={(e) => set({ ...f, reg: fmtReg(e.target.value) })} placeholder="000-00-00000" inputMode="numeric" /></label>
      <label className="fld"><span className="fld__label">담당자 이메일</span><input className="fld__input fld__input--lg" value={f.email} onChange={(e) => set({ ...f, email: e.target.value.trim() })} placeholder="세금계산서 받을 이메일" type="email" /></label>
    </>
  );
}

export function TaxRequest({ id, hasBiz, height, defaults }: { id: string; hasBiz: boolean; height: number; defaults: Biz }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [f, setF] = useState<Biz>(defaults);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  const ask = () => start(async () => {
    setErr('');
    if (!hasBiz) { ref.current?.showModal(); return; }
    const r = await requestTax(id);
    if (!r.ok && r.needBiz) ref.current?.showModal(); else if (!r.ok) setErr(r.error ?? '요청하지 못했어요');
  });
  return (
    <>
      <button type="button" className="btn-ghost" style={{ height, flex: height > 40 ? 1 : undefined }} disabled={pending} onClick={ask}>세금계산서 발행 요청</button>
      {err && <span className="pubhint" style={{ margin: 0 }}>{err}</span>}
      <dialog ref={ref} className="modal" aria-labelledby={`biz-${id}`} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <form className="modal__card" style={{ width: 480 }}
          onSubmit={(e) => { e.preventDefault(); if (!bizOk(f)) return; start(async () => { const r = await saveBizAndRequest(id, f); if (r.ok) ref.current?.close(); else setErr(r.error ?? '저장하지 못했어요'); }); }}>
          <div className="stack" style={{ gap: 4 }}>
            <span className="modal__title" id={`biz-${id}`}>사업자 정보 입력</span>
            <span className="muted" style={{ fontSize: 15 }}>세금계산서 발행에 필요해요. 한 번 저장하면 다음부턴 바로 요청돼요.</span>
          </div>
          <BizFields f={f} set={setF} />
          {err && <span className="pubhint" style={{ margin: 0, textAlign: 'left' }}>{err}</span>}
          <div className="row" style={{ marginTop: 4 }}>
            <button type="button" className="btn-ghost" style={{ width: 100, height: 56, fontSize: 17 }} onClick={() => ref.current?.close()}>취소</button>
            <button className="btn-ink" style={{ flex: 1, height: 56, fontSize: 17, borderRadius: 16 }} disabled={!bizOk(f) || pending}>저장하고 요청하기</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

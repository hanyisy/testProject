'use client';
/* 문의 상태 칩 — 데스크톱: 드롭다운(아래쪽 행은 위로 열림) / 모바일: 하단 시트 (시안 2d · 1d)
 * 계약을 고르면 계약 금액을 입력하고 저장 */
import { useEffect, useRef, useState, useTransition } from 'react';
import { setInquiryStatus } from './actions';

export const STATUS_COLORS: Record<string, [string, string]> = {
  '신규': ['var(--s1b)', 'var(--s1f)'], '상담': ['var(--s2b)', 'var(--s2f)'], '견적': ['var(--warnb)', 'var(--warnf)'],
  '계약': ['var(--s4b)', 'var(--s4f)'], '완료': ['var(--chip)', 'var(--s5f)'], '무산': ['var(--s6b)', 'var(--red)']
};
const ORDER = Object.keys(STATUS_COLORS);

export default function StatusPicker({ id, title, status, amount, needs, up }: { id: string; title: string; status: string; amount: number | null; needs: boolean; up?: boolean }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(status);
  const [amt, setAmt] = useState(amount ?? 0);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const save = (s: string, a?: number) => start(async () => { await setInquiryStatus(id, s, a); setOpen(false); });
  const [bg, fg] = STATUS_COLORS[status] ?? ['var(--chip)', 'var(--s5f)'];
  return (
    <div className="spick" ref={ref}>
      <button type="button" className={'spick__chip' + (needs ? ' is-needs' : '')} style={needs ? undefined : { background: bg, color: fg }}
        aria-haspopup="dialog" aria-expanded={open} onClick={() => { setSel(status); setAmt(amount ?? 0); setOpen(!open); }}>
        {needs ? `${status} · 결과 입력` : status}<span aria-hidden="true" style={{ fontSize: 10 }}>▼</span>
      </button>
      {open && (
        <>
          <div className="spick__backdrop" onClick={() => setOpen(false)} />
          <div className={'spick__pop' + (up ? ' is-up' : '')} role="dialog" aria-label="상태 변경">
            <span className="spick__grab" aria-hidden="true" />
            <div className="spick__head"><b>상태 변경</b><span>{title}</span></div>
            <div className="spick__opts">
              {ORDER.map((s) => (
                <button key={s} type="button" className="spick__opt" aria-pressed={sel === s} disabled={pending}
                  onClick={() => (s === '계약' ? setSel(s) : save(s))}>
                  <span className="spick__tag" style={{ background: STATUS_COLORS[s][0], color: STATUS_COLORS[s][1] }}>{s}</span>
                  {sel === s && <span className="spick__cur">✓</span>}
                </button>
              ))}
            </div>
            {sel === '계약' && (
              <div className="spick__amt">
                <span className="spick__k">계약 금액</span>
                <label className="spick__input">
                  <input inputMode="numeric" placeholder="0" value={amt ? amt.toLocaleString('ko-KR') : ''} aria-label="계약 금액"
                    onChange={(e) => setAmt(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)} />
                  <span>원</span>
                </label>
                <div className="spick__btns">
                  <button type="button" className="spick__cancel" onClick={() => setOpen(false)}>취소</button>
                  <button type="button" className="spick__save" disabled={pending || amt <= 0} onClick={() => save('계약', amt)}>{amt > 0 ? '저장' : '금액을 입력해 주세요'}</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

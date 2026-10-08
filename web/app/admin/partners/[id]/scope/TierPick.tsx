'use client';
/* "이 단계로 변경" — 기본은 바로 바뀌고, 확장·최대는 위험 경고 확인 창 (체크해야 변경 버튼이 켜짐) */
import { useRef, useState } from 'react';
import { setScope } from '../../actions';

export default function TierPick({ id, tier, current, can, note }: { id: string; tier: string; current: boolean; can: boolean; note: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [ack, setAck] = useState(false);
  if (current) return <button type="button" className="tier__btn" aria-current="true">현재 선택</button>;
  if (!can) return <button type="button" className="tier__btn" disabled title="최고 관리자 · 관리팀만 바꿀 수 있어요">이 단계로 변경</button>;
  if (tier === '기본') {
    return (
      <form action={setScope}>
        <input type="hidden" name="id" value={id} /><input type="hidden" name="scope" value={tier} />
        <button className="tier__btn">이 단계로 변경</button>
      </form>
    );
  }
  return (
    <>
      <button type="button" className="tier__btn" onClick={() => { setAck(false); ref.current?.showModal(); }}>이 단계로 변경</button>
      <dialog ref={ref} className="modal" aria-labelledby={`m-${tier}`} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <form action={async (fd) => { await setScope(fd); ref.current?.close(); }} className="modal__card">
          <input type="hidden" name="id" value={id} /><input type="hidden" name="scope" value={tier} />
          <div className="modal__head"><span className="modal__icon" aria-hidden="true">!</span><span className="modal__title" id={`m-${tier}`}>{tier} 범위로 바꿀까요?</span></div>
          <p className="modal__text">검색엔진은 사이트 단위로 평가해서, 걸리면 현장 페이지까지 함께 내려갑니다.</p>
          <p className="hint" style={{ fontSize: 14, lineHeight: 1.5 }}>{note}</p>
          <label className="ack">
            <input type="checkbox" name="ack" className="sr-only" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            <span className="ack__box" aria-hidden="true" />
            위험을 이해했고 파트너에게 설명했어요
          </label>
          <div className="row">
            <button type="button" className="btn-ghost" style={{ flex: 1, height: 50, fontSize: 15 }} onClick={() => ref.current?.close()}>취소</button>
            <button className="btn-red" disabled={!ack}>{tier}{/[가-힣]/.test(tier) && (tier.charCodeAt(tier.length - 1) - 0xAC00) % 28 ? '으로' : '로'} 변경</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

'use client';
/* 서비스 지역 추가 — 같은 업종이 이미 쓰는 지역이면 막고 이유를 보여 줌 (본사만 추가) */
import { useActionState } from 'react';
import { addRegion, type RegionState } from '../../actions';

export default function RegionAdd({ id }: { id: string }) {
  const [state, action, pending] = useActionState<RegionState, FormData>(addRegion, {});
  return (
    <>
      <form action={action} className="row">
        <input type="hidden" name="id" value={id} />
        <input className="fld__input" name="region" placeholder="예) 서울 송파" aria-label="추가할 지역" style={{ flex: 1 }} required />
        <button className="btn-ghost" disabled={pending}>추가</button>
      </form>
      {state.error && <span className="err-line" role="alert">{state.error}</span>}
    </>
  );
}

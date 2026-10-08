'use client';
/* 임시 비밀번호 다시 만들어 전달하기 — 새 값은 이 화면에서 한 번만 보임 */
import { useActionState, useState } from 'react';
import { reissuePassword, type ReissueState } from '../../actions';

export default function Reissue({ id, loginId, phone }: { id: string; loginId: string; phone: string }) {
  const [state, action, pending] = useActionState<ReissueState, FormData>(reissuePassword, {});
  const [copied, setCopied] = useState(false);
  if (!state.pw) {
    return (
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <button className="btn-ghost btn-ghost--block" disabled={pending}>임시 비밀번호 다시 만들어 전달하기</button>
      </form>
    );
  }
  return (
    <div className="box-surf box-surf--pad">
      <span className="hint" style={{ fontWeight: 700, fontSize: 14 }}>새 임시 비밀번호 · 이 화면에서만 보여요</span>
      <span className="pw-big">{state.pw}</span>
      <span className="hint">기존 비밀번호는 바로 막혀요. 다음 로그인 때 비밀번호를 바꾸게 돼요</span>
      <form action={action} className="row">
        <input type="hidden" name="id" value={id} />
        <button type="button" className="btn-ghost btn-ghost--sm" style={{ flex: 1 }}
          onClick={() => { navigator.clipboard?.writeText(`[현장로그] 로그인 안내
아이디: ${loginId}
임시 비밀번호: ${state.pw}
처음 로그인하면 새 비밀번호를 정해 주세요.
${location.origin}/login`).catch(() => {}); setCopied(true); }}>
          {copied ? '복사됐어요' : '안내문 복사'}
        </button>
        <button name="op" value="sms" className="btn-blue" style={{ flex: 1.3, height: 40 }} disabled={state.sent}>
          {state.sent ? `보냈어요 · ${phone}` : '담당자 휴대폰으로 문자 보내기'}
        </button>
      </form>
    </div>
  );
}

'use client';
import { useActionState, useState } from 'react';
import { changePassword, type PasswordState } from '../actions';

/* 규칙은 lib/password.ts 의 passwordRules 와 같음 (서버에서 다시 검사) */
const rules = (pw: string, again: string) => [
  { label: '8자 이상', ok: pw.length >= 8 },
  { label: '영문과 숫자 함께', ok: /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw) },
  { label: '두 칸이 같아요', ok: !!again && pw === again }
];

export default function PasswordForm({ next, homeLabel }: { next: string; homeLabel: string }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, {});
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const list = rules(pw, again);
  const ok = list.every((r) => r.ok);
  return (
    <form action={action} className="auth__card">
      <div className="auth__head">
        <h1 className="auth__h">새 비밀번호를 정해 주세요</h1>
        <p className="auth__p">임시 비밀번호로 처음 로그인했어요. 새 비밀번호를 정해야 {homeLabel} 넘어가요.</p>
      </div>
      {state.error && (
        <div className="auth__alert auth__alert--err" role="alert">
          <span className="auth__alert-icon" aria-hidden="true">!</span><span className="auth__alert-txt">{state.error}</span>
        </div>
      )}
      <input type="hidden" name="next" value={next} />
      <div className="auth__field">
        <label className="auth__label" htmlFor="npw">새 비밀번호</label>
        <div className="auth__pw">
          <input id="npw" name="password" type={show ? 'text' : 'password'} placeholder="8자 이상" autoComplete="new-password"
            value={pw} onChange={(e) => setPw(e.target.value)} required />
          <button type="button" className="auth__eye" onClick={() => setShow(!show)} aria-pressed={show}>{show ? '가리기' : '보기'}</button>
        </div>
      </div>
      <div className="auth__field">
        <label className="auth__label" htmlFor="npw2">한 번 더 입력</label>
        <div className="auth__pw">
          <input id="npw2" name="again" type={show ? 'text' : 'password'} placeholder="같은 비밀번호" autoComplete="new-password"
            value={again} onChange={(e) => setAgain(e.target.value)} required />
        </div>
      </div>
      <div className="rules" aria-live="polite">
        {list.map((r) => (
          <span key={r.label} className={'rule' + (r.ok ? ' is-ok' : '')}><span className="rule__dot" aria-hidden="true">✓</span>{r.label}</span>
        ))}
      </div>
      <button type="submit" className="auth__submit" disabled={!ok || pending}>저장하고 시작하기</button>
    </form>
  );
}

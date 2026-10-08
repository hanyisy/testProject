'use client';
import { useActionState, useEffect, useState } from 'react';
import { login, type LoginState } from './actions';

/** 잠금 중: "9:59 후 다시 시도" — 시간이 다 되면 다시 로그인 버튼 */
function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  if (left === 0) return <button type="submit" className="auth__submit">로그인</button>;
  return (
    <button type="button" className="auth__submit auth__submit--off" disabled>
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} 후 다시 시도
    </button>
  );
}

function Alert({ kind, title, sub }: { kind: 'err' | 'lock' | 'info'; title: string; sub?: string }) {
  return (
    <div className={`auth__alert auth__alert--${kind}`} role={kind === 'info' ? 'status' : 'alert'}>
      <span className="auth__alert-icon" aria-hidden="true">{kind === 'info' ? 'i' : '!'}</span>
      <span className="auth__alert-txt">{title}{sub && <small>{sub}</small>}</span>
    </div>
  );
}

export default function LoginForm({ next, expired }: { next: string; expired: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { id: '' });
  const [show, setShow] = useState(false);
  const invalid = state.error === 'invalid';
  return (
    <form action={action} className={'auth__card' + (invalid ? ' auth--err' : '')}>
      <span className="auth__logo">현장로그</span>
      {expired && !state.error && <Alert kind="info" title="로그인 시간이 지났어요" sub="다시 로그인하면 보던 화면으로 돌아가요" />}
      {invalid && <Alert kind="err" title="아이디 또는 비밀번호가 맞지 않아요" sub={`5번 틀리면 잠시 로그인할 수 없어요 · 남은 횟수 ${state.left}번`} />}
      {state.error === 'locked' && <Alert kind="lock" title="잠시 후 다시 시도해 주세요" sub="5번 틀려서 10분 동안 로그인할 수 없어요" />}
      {state.error === 'disabled' && <Alert kind="err" title="사용 중지된 계정이에요" sub="본사 담당자에게 연락해 주세요" />}

      <input type="hidden" name="next" value={next} />
      <label className="auth__field">
        <span className="auth__label">아이디</span>
        <input className="auth__input" name="id" defaultValue={state.id} key={`${state.id}-${state.error ?? ''}`}
          autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </label>
      <div className="auth__field">
        <label className="auth__label" htmlFor="pw">비밀번호</label>
        <div className="auth__pw">
          <input id="pw" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required />
          <button type="button" className="auth__eye" onClick={() => setShow(!show)} aria-pressed={show}>{show ? '가리기' : '보기'}</button>
        </div>
      </div>
      <label className="auth__keep">
        <input type="checkbox" name="keep" className="sr-only" />
        <span className="auth__box" aria-hidden="true" />
        로그인 상태 유지
      </label>
      {state.error === 'locked' && state.lockedUntil
        ? <Countdown until={state.lockedUntil} key={state.lockedUntil} />
        : <button type="submit" className="auth__submit" disabled={pending}>로그인</button>}
      <span className="auth__foot">파트너와 본사 직원이 같은 화면에서 로그인해요 · 권한에 맞는 화면으로 이동해요</span>
      <span className="auth__help">비밀번호를 잊었다면 본사 담당자에게 연락해 주세요</span>
    </form>
  );
}

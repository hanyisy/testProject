import Link from 'next/link';
import { homeOf, readSession } from '@/lib/auth';
import { logout } from '../login/actions';

export const metadata = { title: '권한 없음' };

/* 시안 없음 — 다른 역할의 주소로 들어왔을 때. 로그인 카드와 같은 모양 */
export default async function Forbidden() {
  const { user } = await readSession();
  return (
    <main className="auth">
      <div className="auth__card">
        <span className="auth__logo">현장로그</span>
        <div className="auth__alert auth__alert--lock" role="alert">
          <span className="auth__alert-icon" aria-hidden="true">!</span>
          <span className="auth__alert-txt">이 화면을 볼 권한이 없어요<small>계정 권한에 맞는 화면으로 이동해 주세요</small></span>
        </div>
        {user ? (
          <>
            <p className="auth__p">{user.kind === 'partner' ? '파트너' : user.role} {user.name} 계정으로 로그인돼 있어요.</p>
            <Link href={homeOf(user)} className="auth__submit">내 화면으로 가기</Link>
            <form action={logout}><button className="btn-line" style={{ width: '100%' }}>다른 계정으로 로그인</button></form>
          </>
        ) : (
          <Link href="/login" className="auth__submit">로그인</Link>
        )}
        <span className="auth__help">권한이 필요하면 본사 담당자에게 연락해 주세요</span>
      </div>
    </main>
  );
}

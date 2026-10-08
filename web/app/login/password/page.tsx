import { redirect } from 'next/navigation';
import { readSession, safeNext } from '@/lib/auth';
import PasswordForm from './PasswordForm';
import { DEMO_LOGIN } from '@/lib/config';

export const metadata = { title: '새 비밀번호' };

/* 시안 3-login-2 · 2l · 1l — 임시 비밀번호로 처음 로그인하면 바로 이 화면 */
export default async function PasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { user } = await readSession();
  if (!user) redirect('/login?reason=expired');
  return (
    <main className="auth">
      <PasswordForm next={safeNext(sp.next)} homeLabel={user.kind === 'partner' ? '홈으로' : '대시보드로'} allowSkip={DEMO_LOGIN} />
    </main>
  );
}

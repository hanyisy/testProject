import { redirect } from 'next/navigation';
import { homeOf, readSession, safeNext } from '@/lib/auth';
import LoginForm from './LoginForm';

export const metadata = { title: '로그인' };

/* 시안 3-login · 2k · 1k — 파트너와 본사 직원이 같은 화면에서 로그인 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { user } = await readSession();
  if (user) redirect(user.mustChangePassword ? '/login/password' : homeOf(user));
  return (
    <main className="auth">
      <LoginForm next={safeNext(sp.next)} expired={sp.reason === 'expired'} />
    </main>
  );
}

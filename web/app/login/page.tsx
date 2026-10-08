import { redirect } from 'next/navigation';
import { homeOf, readSession, safeNext } from '@/lib/auth';
import LoginForm from './LoginForm';
import DemoAccounts from './DemoAccounts';
import { DEMO_LOGIN } from '@/lib/config';

export const metadata = { title: '로그인' };

/* 시안 3-login · 2k · 1k — 파트너와 본사 직원이 같은 화면에서 로그인 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { user } = await readSession();
  /* 이미 로그인했으면 내 화면으로 (데모 계정을 바꾸러 온 경우 ?switch=1 은 그대로 보여 줌) */
  if (user && !(DEMO_LOGIN && sp.switch)) redirect(user.mustChangePassword ? '/login/password' : homeOf(user));
  return (
    <main className="auth auth--stack">
      <LoginForm next={safeNext(sp.next)} expired={sp.reason === 'expired'} disabled={sp.demo === 'disabled'} />
      {DEMO_LOGIN && <DemoAccounts next={safeNext(sp.next)} />}
    </main>
  );
}

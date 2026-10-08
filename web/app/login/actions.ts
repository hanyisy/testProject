'use server';
/* 로그인 · 첫 로그인 비밀번호 변경 · 로그아웃 */
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import {
  MAX_FAILS, attemptState, clearFailures, createSession, destroySession, readSession, recordFailure, safeNext
} from '@/lib/auth';
import { hashPassword, passwordRules, verifyPassword } from '@/lib/password';

export type LoginState = { id: string; error?: 'invalid' | 'locked' | 'disabled'; left?: number; lockedUntil?: number };

/** next가 이 계정이 볼 수 있는 곳이면 거기로, 아니면 계정의 홈으로 */
function landing(kind: 'staff' | 'partner', next: string) {
  const home = kind === 'partner' ? '/partner' : '/admin';
  return next && next.startsWith(home) ? next : home;
}

export async function login(_: LoginState, fd: FormData): Promise<LoginState> {
  const id = String(fd.get('id') ?? '').trim();
  const pw = String(fd.get('password') ?? '');
  const keep = fd.get('keep') === 'on';
  const next = safeNext(fd.get('next'));
  if (!id || !pw) return { id, error: 'invalid', left: MAX_FAILS - (await attemptState(id || '-')).fails };

  const lock = await attemptState(id);
  if (lock.lockedUntil) return { id, error: 'locked', lockedUntil: lock.lockedUntil.getTime() };

  const db = await getDb();
  const [user] = await db.select().from(t.users).where(eq(t.users.loginId, id)).limit(1);
  if (!user || !(await verifyPassword(pw, user.passwordHash))) {
    const r = await recordFailure(id);
    if (r.lockedUntil) return { id, error: 'locked', lockedUntil: r.lockedUntil.getTime() };
    return { id, error: 'invalid', left: MAX_FAILS - r.fails };
  }
  // 비밀번호가 맞을 때만 사용 중지 여부를 알려 줌 (아이디가 있는지 흘리지 않게)
  if (user.status === '사용 중지') return { id, error: 'disabled' };

  await clearFailures(id);
  await db.update(t.users).set({ lastLoginAt: new Date() }).where(eq(t.users.id, user.id));
  await createSession(user.id, keep);
  const to = landing(user.kind, next);
  redirect(user.mustChangePassword ? `/login/password?next=${encodeURIComponent(to)}` : to);
}

export type PasswordState = { error?: string };

export async function changePassword(_: PasswordState, fd: FormData): Promise<PasswordState> {
  const { user } = await readSession();
  if (!user) redirect('/login?reason=expired');
  const pw = String(fd.get('password') ?? '');
  const again = String(fd.get('again') ?? '');
  if (!passwordRules(pw, again).every((r) => r.ok)) return { error: '비밀번호 조건을 확인해 주세요' };
  const db = await getDb();
  await db.update(t.users)
    .set({ passwordHash: await hashPassword(pw), mustChangePassword: false, status: '사용 중' })
    .where(eq(t.users.id, user.id));
  redirect(landing(user.kind, safeNext(fd.get('next'))));
}

/** 컨펌용: 데모 계정으로 바로 들어가기 (비밀번호 없이). DEMO_LOGIN=off 이면 막힘 */
export async function demoLogin(fd: FormData) {
  const { DEMO_LOGIN } = await import('@/lib/config');
  if (!DEMO_LOGIN) return;
  const id = String(fd.get('id') ?? '');
  const db = await getDb();
  const [user] = await db.select().from(t.users).where(eq(t.users.loginId, id)).limit(1);
  if (!user || user.status === '사용 중지') redirect('/login?switch=1&demo=disabled');
  await destroySession();
  await createSession(user.id, false);
  const to = landing(user.kind, safeNext(fd.get('next')));
  redirect(user.mustChangePassword ? `/login/password?next=${encodeURIComponent(to)}` : to);
}

export async function logout() {
  await destroySession();
  redirect('/login');
}

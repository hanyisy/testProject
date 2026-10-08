/* 로그인 세션 · 권한 — 공개 회원가입 없음, 본사가 발급한 계정만 (docs/architecture.md "사용자와 권한") */
import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, gt } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';

export const SESSION_COOKIE = 'hl_session';
/** 컨펌용: 첫 로그인 비밀번호 변경을 이번 로그인만 건너뜀 (DEMO_LOGIN=off 면 무시) */
export const PW_LATER_COOKIE = 'hl_pw_later';
async function pwLater() {
  if (process.env.DEMO_LOGIN === 'off') return false;
  return (await cookies()).get(PW_LATER_COOKIE)?.value === '1';
}
const HOURS = 3600 * 1000;
const SESSION_TTL = 12 * HOURS;            // 로그인 상태 유지 안 함
const KEEP_TTL = 30 * 24 * HOURS;          // 로그인 상태 유지
export const MAX_FAILS = 5;
export const LOCK_MINUTES = 10;

export type Role = '최고 관리자' | '관리팀' | '제작 담당';
export type SessionUser = {
  id: string; loginId: string; name: string; kind: 'staff' | 'partner'; role: Role | null;
  partnerId: string | null; mustChangePassword: boolean;
};

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export async function createSession(userId: string, keep: boolean) {
  const db = await getDb();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + (keep ? KEEP_TTL : SESSION_TTL));
  const ua = (await headers()).get('user-agent');
  await db.insert(t.sessions).values({ userId, tokenHash: sha(token), keep, expiresAt, userAgent: ua });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/',
    ...(keep ? { expires: expiresAt } : {})
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(t.sessions).where(eq(t.sessions.tokenHash, sha(token)));
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(PW_LATER_COOKIE);
}

/** 지금 로그인한 사용자. 쿠키가 있었는데 끝났으면 { expired: true } */
export async function readSession(): Promise<{ user: SessionUser | null; expired: boolean }> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { user: null, expired: false };
  const db = await getDb();
  const rows = await db
    .select({ s: t.sessions, u: t.users })
    .from(t.sessions)
    .innerJoin(t.users, eq(t.users.id, t.sessions.userId))
    .where(and(eq(t.sessions.tokenHash, sha(token)), gt(t.sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || row.u.status === '사용 중지') return { user: null, expired: true };
  await db.update(t.sessions).set({ lastSeenAt: new Date() }).where(eq(t.sessions.id, row.s.id));
  const u = row.u;
  return {
    expired: false,
    user: { id: u.id, loginId: u.loginId, name: u.name, kind: u.kind, role: u.role ?? null, partnerId: u.partnerId ?? null, mustChangePassword: u.mustChangePassword }
  };
}

/** 지금 주소 (proxy.ts가 x-pathname 헤더로 넘김) — 로그인 뒤 돌아올 곳 */
async function currentPath() {
  const h = await headers();
  return h.get('x-pathname') || '/';
}

export const homeOf = (u: Pick<SessionUser, 'kind'>) => (u.kind === 'partner' ? '/partner' : '/admin');

/** 같은 사이트 경로만 (열린 리다이렉트 방지) */
export function safeNext(v: unknown) {
  return typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') ? v : '';
}

/** 본사 화면: 로그인 · 비밀번호 변경 · 역할 검사 */
export async function requireStaff(roles?: Role[]): Promise<SessionUser> {
  const { user, expired } = await readSession();
  const here = await currentPath();
  if (!user) redirect(`/login?next=${encodeURIComponent(here)}${expired ? '&reason=expired' : ''}`);
  if (user.mustChangePassword && !(await pwLater())) redirect(`/login/password?next=${encodeURIComponent(here)}`);
  if (user.kind !== 'staff' || (roles && !roles.includes(user.role as Role))) redirect(`/forbidden?from=${encodeURIComponent(here)}`);
  return user;
}

/** 본사 화면 + 권한 표(lib/permissions.ts) 검사 */
export async function requirePerm(perm: import('./permissions').Perm): Promise<SessionUser> {
  const { PERMS } = await import('./permissions');
  return requireStaff([...PERMS[perm]] as Role[]);
}

/** 파트너 화면: 로그인 · 비밀번호 변경 · 파트너 계정 검사 */
export async function requirePartner(): Promise<SessionUser & { partnerId: string }> {
  const { user, expired } = await readSession();
  const here = await currentPath();
  if (!user) redirect(`/login?next=${encodeURIComponent(here)}${expired ? '&reason=expired' : ''}`);
  if (user.mustChangePassword && !(await pwLater())) redirect(`/login/password?next=${encodeURIComponent(here)}`);
  if (user.kind !== 'partner' || !user.partnerId) redirect(`/forbidden?from=${encodeURIComponent(here)}`);
  /* 계약이 끝난(종료) 업체: 결제 내역(영수증 · 세금계산서)만 보고, 사진 · 발행 · 문의 처리는 막음 */
  const db = await getDb();
  const [p] = await db.select({ status: t.partners.status }).from(t.partners).where(eq(t.partners.id, user.partnerId)).limit(1);
  if (p?.status === '종료' && !here.startsWith('/partner/billing')) redirect(`/forbidden?from=${encodeURIComponent(here)}&ended=1`);
  return user as SessionUser & { partnerId: string };
}

/** 로그인 실패 횟수 · 잠금 (5회 실패 10분) */
export async function attemptState(loginId: string) {
  const db = await getDb();
  const [row] = await db.select().from(t.loginAttempts).where(eq(t.loginAttempts.loginId, loginId)).limit(1);
  if (!row) return { fails: 0, lockedUntil: null as Date | null };
  if (row.lockedUntil) {
    // 잠금 중이면 5회, 잠금 시간이 지났으면 처음부터
    return row.lockedUntil > new Date() ? { fails: MAX_FAILS, lockedUntil: row.lockedUntil } : { fails: 0, lockedUntil: null };
  }
  return { fails: row.failedCount, lockedUntil: null };
}

export async function recordFailure(loginId: string) {
  const db = await getDb();
  const { fails } = await attemptState(loginId);
  const next = fails + 1;
  const lockedUntil = next >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null;
  await db.insert(t.loginAttempts).values({ loginId, failedCount: next, lockedUntil, updatedAt: new Date() })
    .onConflictDoUpdate({ target: t.loginAttempts.loginId, set: { failedCount: next, lockedUntil, updatedAt: new Date() } });
  return { fails: next, lockedUntil };
}

export async function clearFailures(loginId: string) {
  const db = await getDb();
  await db.delete(t.loginAttempts).where(eq(t.loginAttempts.loginId, loginId));
}

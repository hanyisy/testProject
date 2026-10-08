'use server';
/* 내 계정 (파트너 설정 2h · 본사 내 계정 3z-5 공용): 이름 · 아이디(중복 확인) · 비밀번호 변경 */
import { revalidatePath } from 'next/cache';
import { and, eq, ne } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { readSession } from '@/lib/auth';
import { hashPassword, passwordRules, verifyPassword } from '@/lib/password';

const ID_RE = /^[a-z0-9._]{4,20}$/;

async function me() {
  const { user } = await readSession();
  if (!user) throw new Error('로그인이 필요해요');
  return user;
}

export async function checkLoginId(loginId: string): Promise<'ok' | 'taken' | 'invalid'> {
  const user = await me();
  if (!ID_RE.test(loginId)) return 'invalid';
  const db = await getDb();
  const [hit] = await db.select({ id: t.users.id }).from(t.users).where(and(eq(t.users.loginId, loginId), ne(t.users.id, user.id))).limit(1);
  return hit ? 'taken' : 'ok';
}

export async function saveAccount(name: string, loginId: string) {
  const user = await me();
  if (!name.trim()) return { ok: false as const, error: '이름을 입력해 주세요' };
  const st = await checkLoginId(loginId);
  if (st !== 'ok') return { ok: false as const, error: st === 'taken' ? '이미 사용 중인 아이디예요' : '아이디는 영문 소문자 · 숫자 · . _ 4–20자예요' };
  const db = await getDb();
  await db.update(t.users).set({ name: name.trim(), loginId }).where(eq(t.users.id, user.id));
  revalidatePath('/', 'layout');
  return { ok: true as const };
}

export async function changeMyPassword(old: string, pw: string, again: string) {
  const user = await me();
  if (!passwordRules(pw, again).every((r) => r.ok)) return { ok: false as const, error: '새 비밀번호 조건을 확인해 주세요' };
  const db = await getDb();
  const [row] = await db.select({ hash: t.users.passwordHash }).from(t.users).where(eq(t.users.id, user.id)).limit(1);
  if (!row || !(await verifyPassword(old, row.hash))) return { ok: false as const, error: '지금 비밀번호가 맞지 않아요' };
  if (old === pw) return { ok: false as const, error: '지금 비밀번호와 다른 비밀번호를 써 주세요' };
  await db.update(t.users).set({ passwordHash: await hashPassword(pw), mustChangePassword: false, status: '사용 중' }).where(eq(t.users.id, user.id));
  return { ok: true as const };
}

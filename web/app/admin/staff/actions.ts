'use server';
/* 직원 계정 관리 (3z · 3z-2 · 3z-4): 추가 · 역할 변경 · 임시 비밀번호 재발급 · 사용 중지/다시 사용 — 최고 관리자만
 * 직원은 삭제하지 않고 사용 중지 (작업 기록 보존) */
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePerm, type Role } from '@/lib/auth';
import { hashPassword, tempPassword } from '@/lib/password';
import { isUuid, loginIdTaken } from '@/lib/partners';

const ID_RE = /^[a-z0-9][a-z0-9._]{2,29}$/;
const ROLES: Role[] = ['최고 관리자', '관리팀', '제작 담당'];

export async function checkStaffId(id: string): Promise<'ok' | 'taken' | 'invalid'> {
  await requirePerm('직원 계정 관리');
  if (!ID_RE.test(id)) return 'invalid';
  return (await loginIdTaken(id)) ? 'taken' : 'ok';
}

export type NewStaff = { name: string; phone: string; email: string; id: string; pw: string; role: Role };

export async function createStaff(s: NewStaff): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const u = await requirePerm('직원 계정 관리');
  if (!s.name.trim()) return { ok: false, error: '이름을 입력해 주세요' };
  if (!ID_RE.test(s.id)) return { ok: false, error: '아이디는 영문 소문자 · 숫자 3자 이상이에요' };
  if (await loginIdTaken(s.id)) return { ok: false, error: '이미 사용 중인 아이디예요' };
  if (s.pw.length < 8 || !/[a-zA-Z]/.test(s.pw) || !/[0-9]/.test(s.pw)) return { ok: false, error: '임시 비밀번호는 영문과 숫자를 섞어 8자 이상이에요' };
  if (!ROLES.includes(s.role)) return { ok: false, error: '역할을 골라 주세요' };
  const db = await getDb();
  const [row] = await db.insert(t.users).values({
    loginId: s.id, passwordHash: await hashPassword(s.pw), kind: 'staff', role: s.role, name: s.name.trim(),
    phone: s.phone.trim() || null, email: s.email.trim() || null, status: '첫 로그인 전', mustChangePassword: true, createdBy: u.id
  }).returning();
  await db.insert(t.auditLogs).values({ userId: u.id, action: '직원 추가', targetType: 'user', targetId: row.id, detail: { loginId: s.id, role: s.role } });
  revalidatePath('/admin/staff');
  return { ok: true, userId: row.id };
}

/** 안내 문자 (문자 발송 연동 전 — 기록만) */
export async function sendStaffSms(userId: string, what: '계정 안내' | '임시 비밀번호') {
  const u = await requirePerm('직원 계정 관리');
  if (!isUuid(userId)) return;
  const db = await getDb();
  await db.insert(t.auditLogs).values({ userId: u.id, action: `${what} 문자 발송(데모)`, targetType: 'user', targetId: userId });
}

async function target(id: string) {
  const u = await requirePerm('직원 계정 관리');
  if (!isUuid(id)) return null;
  const db = await getDb();
  const [s] = await db.select().from(t.users).where(and(eq(t.users.id, id), eq(t.users.kind, 'staff'))).limit(1);
  return s ? { u, db, s } : null;
}

export async function setStaffRole(id: string, role: Role) {
  const x = await target(id);
  if (!x || !ROLES.includes(role)) return { ok: false as const, error: '바꿀 수 없어요' };
  /* 최고 관리자가 한 명도 없게 되면 막음 */
  if (x.s.role === '최고 관리자' && role !== '최고 관리자') {
    const supers = await x.db.select({ id: t.users.id }).from(t.users).where(and(eq(t.users.kind, 'staff'), eq(t.users.role, '최고 관리자'), eq(t.users.status, '사용 중')));
    if (supers.filter((r) => r.id !== id).length === 0) return { ok: false as const, error: '최고 관리자가 한 명은 있어야 해요' };
  }
  await x.db.update(t.users).set({ role }).where(eq(t.users.id, id));
  await x.db.insert(t.auditLogs).values({ userId: x.u.id, action: '직원 역할 변경', targetType: 'user', targetId: id, detail: { from: x.s.role, to: role } });
  revalidatePath('/admin', 'layout');
  return { ok: true as const };
}

export async function reissueStaffPassword(id: string) {
  const x = await target(id);
  if (!x) return { ok: false as const };
  const pw = tempPassword();
  await x.db.update(t.users).set({ passwordHash: await hashPassword(pw), mustChangePassword: true }).where(eq(t.users.id, id));
  await x.db.delete(t.sessions).where(eq(t.sessions.userId, id));
  await x.db.insert(t.auditLogs).values({ userId: x.u.id, action: '직원 임시 비밀번호 재발급', targetType: 'user', targetId: id });
  return { ok: true as const, pw };
}

export async function setStaffActive(id: string, active: boolean) {
  const x = await target(id);
  if (!x) return { ok: false as const, error: '바꿀 수 없어요' };
  if (!active && id === x.u.id) return { ok: false as const, error: '내 계정은 사용 중지할 수 없어요' };
  if (!active && x.s.role === '최고 관리자') {
    const supers = await x.db.select({ id: t.users.id }).from(t.users).where(and(eq(t.users.kind, 'staff'), eq(t.users.role, '최고 관리자'), eq(t.users.status, '사용 중')));
    if (supers.filter((r) => r.id !== id).length === 0) return { ok: false as const, error: '최고 관리자가 한 명은 있어야 해요' };
  }
  await x.db.update(t.users).set({ status: active ? (x.s.lastLoginAt ? '사용 중' : '첫 로그인 전') : '사용 중지' }).where(eq(t.users.id, id));
  if (!active) await x.db.delete(t.sessions).where(eq(t.sessions.userId, id));
  await x.db.insert(t.auditLogs).values({ userId: x.u.id, action: active ? '직원 다시 사용' : '직원 사용 중지', targetType: 'user', targetId: id });
  revalidatePath('/admin/staff', 'layout');
  return { ok: true as const };
}

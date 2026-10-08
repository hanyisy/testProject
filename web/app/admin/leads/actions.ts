'use server';
/* 가입 문의 상세: 상태 · 담당 직원 · 상담 메모 */
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePerm } from '@/lib/auth';
import { LEAD_STATUSES } from '@/lib/admin';

const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v);

async function audit(userId: string, action: string, leadId: string, detail: object) {
  const db = await getDb();
  await db.insert(t.auditLogs).values({ userId, action, targetType: 'lead', targetId: leadId, detail });
}

export async function setLeadStatus(fd: FormData) {
  const user = await requirePerm('파트너 관리');
  const id = fd.get('id'), status = String(fd.get('status'));
  if (!isId(id) || !LEAD_STATUSES.includes(status as never)) return;
  const db = await getDb();
  await db.update(t.leads).set({ status: status as '신규' }).where(eq(t.leads.id, id));
  await audit(user.id, '가입 문의 상태 변경', id, { status });
  revalidatePath('/admin', 'layout');
}

export async function setLeadOwner(fd: FormData) {
  const user = await requirePerm('파트너 관리');
  const id = fd.get('id'), owner = fd.get('owner');
  if (!isId(id)) return;
  const db = await getDb();
  const [lead] = await db.select({ owner: t.leads.ownerUserId }).from(t.leads).where(eq(t.leads.id, id)).limit(1);
  /* 이미 담당인 직원을 다시 누르면 담당 해제 (시안 동작) */
  const next = isId(owner) && lead?.owner !== owner ? owner : null;
  await db.update(t.leads).set({ ownerUserId: next }).where(eq(t.leads.id, id));
  await audit(user.id, '가입 문의 담당 변경', id, { owner: next });
  revalidatePath('/admin', 'layout');
}

export async function addLeadMemo(fd: FormData) {
  const user = await requirePerm('파트너 관리');
  const id = fd.get('id'), body = String(fd.get('body') ?? '').trim();
  if (!isId(id) || !body) return;
  const db = await getDb();
  await db.insert(t.leadMemos).values({ leadId: id, userId: user.id, body: body.slice(0, 2000) });
  revalidatePath(`/admin/leads/${id}`);
}

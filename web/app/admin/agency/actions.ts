'use server';
/* 대행 작업 (3m): 파트너가 승인한 블로그 글 → 본사가 올린 뒤 주소 입력 → 완료 (파트너 블로그 화면에 "올림"으로 보임) */
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePerm } from '@/lib/auth';

export async function finishAgencyPost(id: string, raw: string) {
  const u = await requirePerm('대행 작업');
  const url = raw.trim().replace(/^https?:\/\//, '');
  if (!/^[\w-]+(\.[\w-]+)+\/\S+/.test(url)) return { ok: false as const, error: '올린 글 주소를 확인해 주세요' };
  const db = await getDb();
  const [p] = await db.update(t.blogPosts).set({ url, status: '올림', billedThisMonth: true, publishedAt: new Date() })
    .where(and(eq(t.blogPosts.id, id), eq(t.blogPosts.mode, '본사 대행'), eq(t.blogPosts.status, '승인'))).returning();
  if (!p) return { ok: false as const, error: '이미 처리된 글이에요' };
  await db.insert(t.auditLogs).values({ userId: u.id, action: '블로그 대행 완료', targetType: 'blog', targetId: id, detail: { url } });
  revalidatePath('/admin', 'layout');
  return { ok: true as const };
}

'use server';
/* 블로그 (2e · 2f · 2f-2): 올린 글 주소 저장 → 이번 달 발행 집계, 본사 대행 초안 승인, 요금제에 없을 때 추가 문의 */
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePartner } from '@/lib/auth';
import { today } from '@/lib/config';
import { md } from '@/lib/format';

async function own(id: string) {
  const user = await requirePartner();
  const db = await getDb();
  const [post] = await db.select().from(t.blogPosts).where(and(eq(t.blogPosts.id, id), eq(t.blogPosts.partnerId, user.partnerId))).limit(1);
  return { db, post, user };
}

/** 직접 올리기: 내 블로그에 올린 글 주소 */
export async function saveBlogUrl(id: string, raw: string) {
  const url = raw.trim().replace(/^https?:\/\//, '');
  if (!/^[\w-]+(\.[\w-]+)+\/\S+/.test(url)) return { ok: false as const, error: '글 주소를 확인해 주세요 (예: blog.naver.com/아이디/글번호)' };
  const { db, post } = await own(id);
  if (!post) return { ok: false as const, error: '초안을 찾을 수 없어요' };
  await db.update(t.blogPosts).set({ url, status: '올림', billedThisMonth: true, publishedAt: new Date() }).where(eq(t.blogPosts.id, id));
  revalidatePath('/partner/blog');
  return { ok: true as const };
}

/** 본사 대행: 초안 승인 → 본사 대행 작업 목록으로 */
export async function approveBlog(id: string) {
  const { db, post } = await own(id);
  if (!post || (post.status !== '초안' && post.status !== '승인 대기')) return;
  await db.update(t.blogPosts).set({ status: '승인', approvedOn: md(await today()) }).where(eq(t.blogPosts.id, id));
  revalidatePath('/partner/blog');
}

/** 요금제에 없는 기능 · 지역 추가 → 본사에 요청 */
export async function requestToHq(kind: '기능 추가' | '지역 추가', subject: string) {
  const user = await requirePartner();
  const db = await getDb();
  const [dup] = await db.select({ id: t.partnerRequests.id }).from(t.partnerRequests)
    .where(and(eq(t.partnerRequests.partnerId, user.partnerId), eq(t.partnerRequests.subject, subject), eq(t.partnerRequests.status, '접수'))).limit(1);
  if (!dup) await db.insert(t.partnerRequests).values({ partnerId: user.partnerId, kind, subject });
  return { ok: true as const, already: !!dup };
}

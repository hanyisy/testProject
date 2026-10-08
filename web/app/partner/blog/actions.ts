'use server';
/* 블로그 (2e · 2f · 2f-2): 올린 글 주소 저장 → 이번 달 발행 집계, 본사 대행 초안 승인, 요금제에 없을 때 추가 문의
 * 블로그 방식은 업체 기능 설정(partner_features.blog)이 기준 — 글에도 같은 방식을 적어 본사 대행 목록과 맞춤 */
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { requirePartner } from '@/lib/auth';
import { today } from '@/lib/config';
import { md } from '@/lib/format';

async function own(id: string) {
  const user = await requirePartner();
  const db = await getDb();
  const [[post], [f]] = await Promise.all([
    db.select().from(t.blogPosts).where(and(eq(t.blogPosts.id, id), eq(t.blogPosts.partnerId, user.partnerId))).limit(1),
    db.select({ blog: t.partnerFeatures.blog }).from(t.partnerFeatures).where(eq(t.partnerFeatures.partnerId, user.partnerId)).limit(1)
  ]);
  return { db, post, user, mode: f?.blog ?? '꺼짐' };
}

/** 직접 올리기: 내 블로그에 올린 글 주소 */
export async function saveBlogUrl(id: string, raw: string) {
  const url = raw.trim().replace(/^https?:\/\//, '');
  if (!/^[\w-]+(\.[\w-]+)+\/\S+/.test(url) || url.length > 300) return { ok: false as const, error: '글 주소를 확인해 주세요 (예: blog.naver.com/아이디/글번호)' };
  const { db, post, mode } = await own(id);
  if (!post) return { ok: false as const, error: '초안을 찾을 수 없어요' };
  if (mode !== '직접 올리기') return { ok: false as const, error: '직접 올리기 방식일 때만 글 주소를 넣을 수 있어요' };
  await db.update(t.blogPosts).set({ url, mode: '직접 올리기', status: '올림', billedThisMonth: true, publishedAt: new Date() }).where(eq(t.blogPosts.id, id));
  revalidatePath('/partner/blog');
  return { ok: true as const };
}

/** 본사 대행: 초안 승인 → 본사 대행 작업 목록으로 (글 방식도 본사 대행으로 맞춰야 본사 목록에 뜸) */
export async function approveBlog(id: string) {
  const { db, post, mode } = await own(id);
  if (!post || mode !== '본사 대행' || (post.status !== '초안' && post.status !== '승인 대기')) return;
  await db.update(t.blogPosts).set({ mode: '본사 대행', status: '승인', approvedOn: md(await today()) }).where(eq(t.blogPosts.id, id));
  revalidatePath('/partner/blog');
  revalidatePath('/admin/agency');
}

/** 요금제에 없는 기능 · 지역 추가 → 본사에 요청 */
const KINDS = ['기능 추가', '지역 추가'] as const;
export async function requestToHq(kind: (typeof KINDS)[number], subject: string) {
  const user = await requirePartner();
  const sub = String(subject ?? '').trim().slice(0, 40);
  if (!KINDS.includes(kind) || !sub) return { ok: false as const, already: false };
  const db = await getDb();
  const [dup] = await db.select({ id: t.partnerRequests.id }).from(t.partnerRequests)
    .where(and(eq(t.partnerRequests.partnerId, user.partnerId), eq(t.partnerRequests.subject, sub), eq(t.partnerRequests.status, '접수'))).limit(1);
  if (!dup) await db.insert(t.partnerRequests).values({ partnerId: user.partnerId, kind, subject: sub });
  revalidatePath('/admin', 'layout');
  return { ok: true as const, already: !!dup };
}

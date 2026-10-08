'use server';
/* 업체 공개 사이트 문의 폼 → 그 업체의 문의(inquiries)에 신규로 → 접수 완료 화면 (파트너 "문의"에 바로 뜸) */
import { redirect } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { notifyPartner } from '@/lib/adapters/alimtalk';

const str = (v: FormDataEntryValue | null, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function sendInquiry(fd: FormData) {
  const slug = str(fd.get('slug'), 40);
  const from = str(fd.get('from'), 300);
  const back = `/p/${slug}${from ? '/' + from.split('/').map(encodeURIComponent).join('/') : ''}`;
  const name = str(fd.get('name'), 40), phone = str(fd.get('phone'), 20), body = str(fd.get('body'), 2000);
  if (!/^[a-z0-9-]+$/.test(slug) || !name || !/^[0-9+\-\s()]{8,20}$/.test(phone) || str(fd.get('agree')) !== 'y') redirect(`${back}?err=1#contact`);
  const db = await getDb();
  const [p] = await db.select({ id: t.partners.id, status: t.partners.status }).from(t.partners).where(eq(t.partners.slug, slug)).limit(1);
  if (!p || p.status === '종료') redirect(back);
  /* 들어온 페이지: 이 업체의 같은 주소 중 최근 것 (다른 업체 페이지와 섞이지 않게) */
  const [pg] = from ? await db.select().from(t.pages).where(and(eq(t.pages.partnerId, p.id), eq(t.pages.path, from))).orderBy(desc(t.pages.createdAt)).limit(1) : [];
  const title = body.split('\n')[0].slice(0, 60) || `${pg?.title ?? '사이트'} 문의`;
  await db.insert(t.inquiries).values({
    partnerId: p.id, receivedAt: new Date(), title,
    pageId: pg?.id ?? null, pageTitle: pg?.title ?? (from ? decodeURIComponent(from) : '홈'), pageType: pg?.type ?? null,
    channel: '폼', customerName: name, customerPhone: phone, body: body || null, status: '신규', verify: '확인 중'
  });
  await notifyPartner(p.id, 'lead', `새 문의 · ${title}`);
  redirect(`/p/${slug}/contact/done`);
}

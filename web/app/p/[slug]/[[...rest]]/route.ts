/* 업체 공개 사이트 /p/{slug}/… — 계약이 끝난(종료) 업체는 비공개 안내를 410으로, 문의 접수 완료는 완료 화면
 * 업체 사이트 본문은 정적 빌드로 나가므로(운영) 여기서는 이 두 경우만 다룸 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { partnerBySlug } from '@/lib/landing';

const page = async (file: string, status = 200) => new Response(await fs.readFile(path.join(process.cwd(), 'public', 'p', file)), {
  status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
});

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; rest?: string[] }> }) {
  const { slug, rest = [] } = await params;
  const p = /^[a-z0-9-]+$/.test(slug) ? await partnerBySlug(slug) : null;
  if (!p) return page('../404.html', 404);
  if (p.status === '종료') return page('closed.html', 410);
  if (rest.join('/') === 'contact/done') return page('contact-done.html');
  return page('../404.html', 404);
}

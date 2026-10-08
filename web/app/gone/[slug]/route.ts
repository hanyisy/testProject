/* 계약이 끝나 비공개가 된 업체 사이트 — 410 + 색인 제외 (public/p/closed.html) */
import fs from 'node:fs/promises';
import path from 'node:path';

export async function GET() {
  return new Response(await fs.readFile(path.join(process.cwd(), 'public', 'p', 'closed.html')), {
    status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
  });
}

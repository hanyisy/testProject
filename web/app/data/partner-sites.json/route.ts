/* 업체 공개 사이트 머리 · 바닥 정보 — 파트너 정보에서 (모양: public/data/README.md) */
import { partnerSites } from '@/lib/landing';
import { json } from '@/lib/public-response';

export const dynamic = 'force-dynamic';

export async function GET() {
  return json({ items: await partnerSites() });
}

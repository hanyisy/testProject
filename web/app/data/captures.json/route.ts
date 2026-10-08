/* 랜딩 "실제 검색 화면" — 랜딩 관리에서 보이게 한 캡처만 (모양: public/data/README.md) */
import { captures } from '@/lib/landing';
import { json } from '@/lib/public-response';

export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await captures();
  return json({ items: items.map(({ id, image, query, industry, partner, capturedAt, visible, order }) => ({ id, image, query, industry, partner, capturedAt, visible, order })) });
}

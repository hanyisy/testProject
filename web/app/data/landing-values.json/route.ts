/* 랜딩 "실제 값 입력" 자리 — 랜딩 관리에서 넣은 값 (모양: public/data/README.md) */
import { landingValues } from '@/lib/landing';
import { json } from '@/lib/public-response';

export const dynamic = 'force-dynamic';

export async function GET() {
  return json(await landingValues());
}

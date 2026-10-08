/* 랜딩 업종·지역 확인 — 이미 운영 · 준비 중인 조합 { 업종: [지역] } (종료 파트너 지역은 빠짐) */
import { takenMap } from '@/lib/landing';
import { json } from '@/lib/public-response';

export const dynamic = 'force-dynamic';

export async function GET() {
  return json({ taken: await takenMap() });
}

/* 온라인 결제 어댑터 — 외부 결제 대행(PG) 연동 자리. 컨펌 단계: 결제 키(설정 payment_key)가 없으면 바로 승인되는 데모 결제
 * 운영: 같은 함수 이름으로 PG 결제창 요청 → 승인 결과 확인으로 바꿈 */
import 'server-only';
import { getSetting } from '@/lib/admin';

export type PayResult = { ok: true; approvedAt: Date; method: string } | { ok: false; error: string };

export async function chargeOnline(_input: { chargeId: string; amount: number; orderName: string }): Promise<PayResult> {
  const key = await getSetting<string>('payment_key', '');
  if (key) return { ok: false, error: '결제 대행 연동 전이에요 · 본사에 문의해 주세요' };
  return { ok: true, approvedAt: new Date(), method: '카드 (데모 결제)' };
}

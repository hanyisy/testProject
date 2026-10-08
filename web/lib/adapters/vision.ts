/* 사진 분석 어댑터 — 사람이 찍혔는지 (공개 전에 경고 · 자동 비공개)
 * 컨펌 단계: 외부 비전 API 없이 "모름 = 사람 없음"으로 돌려줌 → 파트너가 사진 검토에서 직접 공개를 고름
 * 운영: 같은 함수에서 비전 API(얼굴 · 사람 감지)를 불러 결과를 돌려줌 */
import 'server-only';

export async function detectPerson(_data: Buffer): Promise<boolean> {
  return false;
}

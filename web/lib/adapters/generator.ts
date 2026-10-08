/* 시안 생성 어댑터 — 섹션 블록 조합 + 문구 생성(외부 AI) 자리
 * 컨펌 단계: 시작 시각으로부터 지난 시간만큼 진행된 것으로 보여 줌 (시안마다 조금씩 늦게 시작, 약 15초면 모두 완료)
 * 운영: 같은 함수 이름으로 생성 작업 상태를 조회 */
import 'server-only';

const START_GAP = 2000, DURATION = 9000;

export function draftProgress(startedAt: Date, index: number, now = Date.now()) {
  const t = now - startedAt.getTime() - index * START_GAP;
  return Math.max(0, Math.min(100, Math.round((t / DURATION) * 100)));
}

export const allDone = (startedAt: Date, count: number, now = Date.now()) => draftProgress(startedAt, count - 1, now) >= 100;

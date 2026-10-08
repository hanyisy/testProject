/* 작업 실행기 어댑터 — 빌드 · 배포 · 색인 전송 · 사진 처리 · 시트 동기화
 * 컨펌 단계: 외부(호스팅 · 서치어드바이저 · 드라이브 · 시트)를 부르지 않고, 작업에 적힌 다음 결과(will_fail_again)대로 끝남
 * 운영: 같은 함수 이름으로 실제 워커에 맡기고 결과를 받음 */
import 'server-only';

export type JobResult = { ok: true } | { ok: false; reason: string };

export async function runJob(job: { kind: string; reason: string | null; willFailAgain: boolean }): Promise<JobResult> {
  await new Promise((r) => setTimeout(r, 1200));
  return job.willFailAgain ? { ok: false, reason: job.reason ?? '알 수 없는 오류' } : { ok: true };
}

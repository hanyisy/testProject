/* 도메인 연결 확인 어댑터 — 컨펌 단계 가짜 구현
 * "연결 확인"을 누르면 1.5초 뒤 연결됨 + 인증서 발급 중, 3.5초 뒤 발급 완료 (시안 3e 데모 동작과 같음).
 * 운영에서는 DNS 조회와 호스팅 인증서 상태를 읽어 같은 값을 돌려주면 됩니다. */
import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';

type Domain = typeof t.domains.$inferSelect;

export async function domainStatus(d: Domain): Promise<Pick<Domain, 'connection' | 'certificate'>> {
  if (d.connection !== '확인 중' && d.certificate !== '발급 중') return d;
  const ms = d.checkedAt ? Date.now() - d.checkedAt.getTime() : Infinity;
  const next = ms < 1500 ? { connection: '확인 중' as const, certificate: '대기' as const }
    : ms < 3500 ? { connection: '연결됨' as const, certificate: '발급 중' as const }
      : { connection: '연결됨' as const, certificate: '발급 완료' as const };
  if (next.connection !== d.connection || next.certificate !== d.certificate) {
    const db = await getDb();
    await db.update(t.domains).set(next).where(eq(t.domains.partnerId, d.partnerId));
  }
  return next;
}

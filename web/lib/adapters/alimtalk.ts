/* 알림톡 어댑터 — 파트너에게 보내는 알림 (새 문의 · 결과 입력 필요 · 색인 완료)
 * 업체 알림 설정(partners.notify)을 먼저 보고, 꺼져 있으면 보내지 않음
 * 컨펌 단계: 실제 발송 없이 notify_logs에 기록만 · 운영: 같은 함수에서 알림톡 API(템플릿 코드는 설정 › alimtalk_codes)로 보냄 */
import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';

export type NotifyKind = 'lead' | 'result' | 'indexed';

export async function notifyPartner(partnerId: string, kind: NotifyKind, text: string) {
  const db = await getDb();
  const [p] = await db.select({ notify: t.partners.notify }).from(t.partners).where(eq(t.partners.id, partnerId)).limit(1);
  if (!p) return { sent: false };
  const on = p.notify?.[kind] !== false;
  await db.insert(t.notifyLogs).values({ partnerId, kind, text: text.slice(0, 200), sent: on });
  return { sent: on };
}

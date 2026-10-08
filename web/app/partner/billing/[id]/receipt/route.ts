/* 카드 영수증 · 세금계산서 발행 내역 내려받기 — 결제 · 발행 기록으로 바로 만든 인쇄용 문서(HTML)
 * 국세청 세금계산서 원본(전자 발행)은 발행 대행 연동 후 그 파일로 바꿈 */
import { and, eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { readSession } from '@/lib/auth';
import { getSetting } from '@/lib/admin';
import { won } from '@/lib/format';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const kst = (d: Date | null) => (d ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'long', timeStyle: 'short' }).format(d) : '—');

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kind = new URL(req.url).searchParams.get('kind') === 'tax' ? 'tax' : 'card';
  const { user } = await readSession();
  if (!user) return new Response('로그인이 필요해요', { status: 401 });
  const db = await getDb();
  const where = user.kind === 'partner' ? and(eq(t.charges.id, id), eq(t.charges.partnerId, user.partnerId!)) : eq(t.charges.id, id);
  const [row] = await db.select({ c: t.charges, p: t.partners }).from(t.charges).innerJoin(t.partners, eq(t.partners.id, t.charges.partnerId)).where(where).limit(1);
  if (!row) return new Response('내역이 없어요', { status: 404 });
  const { c, p } = row;
  const [tax] = await db.select().from(t.taxRequests).where(eq(t.taxRequests.chargeId, id)).limit(1);
  if (kind === 'card' && c.state !== '결제 완료') return new Response('결제 완료된 건만 영수증이 있어요', { status: 400 });
  if (kind === 'tax' && tax?.state !== '발행 완료') return new Response('발행 완료된 건만 내려받을 수 있어요', { status: 400 });
  const bill = await getSetting<{ bank: string; account: string; holder: string }>('billing', { bank: '', account: '', holder: '' });

  const title = kind === 'card' ? '카드 결제 영수증' : '세금계산서 발행 내역';
  const rows: [string, string][] = kind === 'card'
    ? [['결제 항목', c.item], ['결제 금액', `${won(c.amount)}원`], ['결제 수단', c.payer ?? '카드'], ['결제 일시', kst(c.confirmedAt)], ['청구일', c.billedOn], ['결제한 업체', p.name]]
    : [['공급자', bill.holder], ['공급받는 자', `${p.bizName ?? p.name} (${p.bizRegNo ?? '—'})`], ['받는 이메일', p.taxEmail ?? '—'], ['품목', c.item],
       ['공급가액', `${won(Math.round(c.amount / 1.1))}원`], ['세액', `${won(c.amount - Math.round(c.amount / 1.1))}원`], ['합계', `${won(c.amount)}원`], ['요청일', tax.requestedOn], ['발행일', kst(tax.issuedAt)]];
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:system-ui,-apple-system,'Malgun Gothic',sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#111}h1{font-size:22px}table{width:100%;border-collapse:collapse}th,td{padding:10px 4px;border-bottom:1px solid #ddd;text-align:left;font-size:15px}th{color:#666;width:34%;font-weight:600}p{color:#666;font-size:13px}</style></head>
<body><h1>${esc(title)}</h1><table>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
<p>현장로그 결제 기록으로 만든 문서예요. ${kind === 'tax' ? '전자세금계산서 원본은 받는 이메일로 발송돼요.' : ''}</p></body></html>`;
  const name = `${title} ${c.billedOn}.html`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` } });
}

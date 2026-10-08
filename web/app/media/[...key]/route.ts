/* 공개 이미지 — 로그인 없이 보여 주는 것만
 * · landing/…        랜딩 캡처
 * · photo/{사진 id}   업체 공개 사이트 사진: 업체가 공개로 정했고 사람이 안 찍힌 사진만 (종료 업체 제외)
 * 그 밖의 파트너 사진은 /files (로그인 필요) */
import { eq } from 'drizzle-orm';
import { getDb, schema as t } from '@/db/client';
import { getFile } from '@/lib/adapters/storage';
import { isUuid } from '@/lib/partners';

const TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const nf = () => new Response('not found', { status: 404 });

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  if (key.some((k) => k.includes('..'))) return nf();
  let fileKey = '';
  if (key[0] === 'landing') fileKey = key.join('/');
  else if (key[0] === 'photo' && isUuid(key[1])) {
    const db = await getDb();
    const [row] = await db.select({ ph: t.photos, status: t.partners.status }).from(t.photos).innerJoin(t.partners, eq(t.partners.id, t.photos.partnerId)).where(eq(t.photos.id, key[1])).limit(1);
    if (!row || !row.ph.partnerPublic || row.ph.hasPerson || row.status === '종료') return nf();
    fileKey = row.ph.fileKey;
  } else return nf();
  const data = await getFile(fileKey);
  if (!data) return nf();
  const ext = fileKey.split('.').pop()?.toLowerCase() ?? '';
  return new Response(new Uint8Array(data), { headers: { 'Content-Type': TYPES[ext] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
}

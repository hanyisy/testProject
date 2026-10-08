/* 올린 파일 보기 — 로그인한 본사 직원, 또는 그 파일을 올린 파트너만. 키 첫 칸이 파트너 id */
import { readSession } from '@/lib/auth';
import { getFile } from '@/lib/adapters/storage';

const TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' };

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const { user } = await readSession();
  if (!user) return new Response('로그인이 필요해요', { status: 401 });
  if (user.kind === 'partner' && key[0] !== user.partnerId) return new Response('볼 수 없는 파일이에요', { status: 403 });
  const data = await getFile(key.join('/'));
  if (!data) return new Response('파일이 없어요', { status: 404 });
  const ext = key[key.length - 1].split('.').pop()?.toLowerCase() ?? '';
  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': TYPES[ext] ?? 'application/octet-stream', 'Cache-Control': 'private, max-age=86400, immutable', 'X-Content-Type-Options': 'nosniff' }
  });
}

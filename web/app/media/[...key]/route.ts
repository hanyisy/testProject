/* 공개 이미지 — 랜딩 캡처(landing/…)만 로그인 없이 보여 줌. 파트너 사진은 /files (로그인 필요) */
import { getFile } from '@/lib/adapters/storage';

const TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  if (key[0] !== 'landing' || key.some((k) => k.includes('..'))) return new Response('not found', { status: 404 });
  const data = await getFile(key.join('/'));
  if (!data) return new Response('not found', { status: 404 });
  const ext = key[key.length - 1].split('.').pop()?.toLowerCase() ?? '';
  return new Response(new Uint8Array(data), { headers: { 'Content-Type': TYPES[ext] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
}

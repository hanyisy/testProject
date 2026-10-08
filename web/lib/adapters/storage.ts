/* 파일 저장 어댑터 — 컨펌 단계: 로컬 폴더(web/.data/uploads) / 운영: S3 호환 저장소로 바꿈 (같은 함수 이름 유지) */
import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = path.join(process.cwd(), '.data', 'uploads');

export async function putFile(key: string, data: Buffer) {
  const file = path.join(ROOT, key);
  if (!file.startsWith(ROOT)) throw new Error('bad key');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
}

export async function getFile(key: string): Promise<Buffer | null> {
  const file = path.join(ROOT, key);
  if (!file.startsWith(ROOT)) return null;
  try { return await fs.readFile(file); } catch { return null; }
}

export const contentHash = (data: Buffer) => createHash('sha1').update(data).digest('hex');

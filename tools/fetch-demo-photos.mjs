/* 확인용 데모 사진 받기 — web/db/demo-photos.json 목록(Unsplash 무료 라이선스)을 web/.data/uploads/demo-stock/ 에 저장
 * node tools/fetch-demo-photos.mjs   (이미 있는 파일은 건너뜀 · git 제외 폴더)
 * 실제 업체 현장 사진이 아니므로 운영 전 교체해야 함 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const list = JSON.parse(await fs.readFile(path.join(ROOT, 'web', 'db', 'demo-photos.json'), 'utf8'));
const dir = path.join(ROOT, 'web', '.data', 'uploads', 'demo-stock');
await fs.mkdir(dir, { recursive: true });

let got = 0, skip = 0, fail = 0, bytes = 0;
for (const [industry, rows] of Object.entries(list.photos)) {
  for (const [id, p] of rows) {
    const file = path.join(dir, `${id}.jpg`);
    try { await fs.access(file); skip++; continue; } catch { /* 새로 받음 */ }
    try {
      const res = await fetch(list.base + p + list.query);
      if (!res.ok || !String(res.headers.get('content-type')).startsWith('image/')) throw new Error(String(res.status));
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(file, buf);
      got++; bytes += buf.length;
    } catch (e) { fail++; console.log(`실패 ${industry} ${id}: ${e.message}`); }
  }
}
console.log(`데모 사진: 새로 ${got}장 (${(bytes / 1048576).toFixed(1)}MB) · 이미 있음 ${skip}장 · 실패 ${fail}장 → ${dir}`);

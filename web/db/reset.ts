/* 컨펌용 DB를 처음 상태(시안 더미 데이터)로 되돌립니다: npm run db:reset
 * PGlite 폴더를 지우면 다음 실행 때 마이그레이션 + 시드가 다시 들어갑니다. */
import fs from 'node:fs';
import { PGLITE_DIR, getDb } from './client';

async function main() {
  if (process.env.DATABASE_URL) {
    console.error('DATABASE_URL이 설정돼 있어요. 실제 DB는 이 스크립트로 지우지 않습니다.');
    process.exit(1);
  }
  fs.rmSync(PGLITE_DIR, { recursive: true, force: true });
  await getDb();
  console.log('시안 더미 데이터로 초기화했어요:', PGLITE_DIR);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

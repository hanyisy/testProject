/* DB 연결 — DATABASE_URL이 있으면 PostgreSQL, 없으면 PGlite(.data/pglite, 설치 없이 도는 Postgres)
 * 처음 연결할 때 마이그레이션을 적용하고, 비어 있으면 시안 더미 데이터를 넣습니다. */
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from './schema';

export type DB = ReturnType<typeof drizzlePglite<typeof schema>>;

const MIGRATIONS = path.join(process.cwd(), 'db', 'migrations');
export const PGLITE_DIR = path.join(process.cwd(), '.data', 'pglite');

type Holder = { db?: DB; ready?: Promise<DB> };
const g = globalThis as unknown as { __hlDb?: Holder };
const holder: Holder = (g.__hlDb ??= {});

async function open(): Promise<DB> {
  let db: DB;
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const pg = drizzlePg(pool, { schema });
    await migratePg(pg, { migrationsFolder: MIGRATIONS });
    db = pg as unknown as DB;
  } else {
    fs.mkdirSync(path.dirname(PGLITE_DIR), { recursive: true });
    const client = new PGlite(PGLITE_DIR);
    db = drizzlePglite(client, { schema });
    await migratePglite(db, { migrationsFolder: MIGRATIONS });
  }
  const { seedIfEmpty } = await import('./seed');
  await seedIfEmpty(db);
  holder.db = db;
  return db;
}

/** 서버 코드에서 DB 쓰기: const db = await getDb(); */
export function getDb(): Promise<DB> {
  if (holder.db) return Promise.resolve(holder.db);
  return (holder.ready ??= open());
}

export { schema };

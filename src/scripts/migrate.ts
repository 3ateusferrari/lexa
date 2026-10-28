import 'dotenv/config';
import pg from 'pg';
import { getDownMigrationSql, getInitialMigrationSql } from '../modules/db/migration-sql.js';

export async function runMigrations(databaseUrl: string, direction: 'up' | 'down' = 'up'): Promise<void> {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const sqlText = direction === 'down' ? getDownMigrationSql() : getInitialMigrationSql();
    await pool.query(sqlText);
  } finally {
    await pool.end();
  }
}

async function main() {
  const databaseUrl =
    process.env.DATABASE_URL ??
    'postgresql://lexa:lexa_dev_password@localhost:5432/lexa_db';
  const isDown = process.argv.includes('--down');
  await runMigrations(databaseUrl, isDown ? 'down' : 'up');
  console.log(`Migration ${isDown ? 'DOWN' : 'UP'} applied successfully.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

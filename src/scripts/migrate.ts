import 'dotenv/config';
import {
  applyMigrationsOnConnection,
  createResilientDatabaseConnection,
} from '../modules/db/client.js';

export async function runMigrations(
  databaseUrl: string,
  direction: 'up' | 'down' = 'up',
): Promise<void> {
  const conn = await createResilientDatabaseConnection(databaseUrl);
  try {
    await applyMigrationsOnConnection(conn, direction);
  } finally {
    await conn.close();
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

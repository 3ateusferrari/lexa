import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

export type DbClient = NodePgDatabase<typeof schema>;

export interface DatabaseConnection {
  pool: pg.Pool;
  db: DbClient;
  close: () => Promise<void>;
}

export function createDatabaseConnection(databaseUrl: string): DatabaseConnection {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
  });

  const db = drizzle(pool, { schema });

  return {
    pool,
    db,
    close: async () => {
      await pool.end();
    },
  };
}

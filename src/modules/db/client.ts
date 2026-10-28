import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { drizzle as drizzleNodePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import pg from 'pg';
import { getDownMigrationSql, getInitialMigrationSql } from './migration-sql.js';
import * as schema from './schema.js';

export type DbClient = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

export interface DatabaseConnection {
  db: DbClient;
  execSql: (sqlText: string) => Promise<void>;
  close: () => Promise<void>;
}

export async function createPgliteConnection(dataDir?: string): Promise<DatabaseConnection> {
  const client = await PGlite.create({
    dataDir,
    extensions: { vector },
  });

  const db = drizzlePglite(client, { schema });

  return {
    db,
    execSql: async (sqlText: string) => {
      await client.exec(sqlText);
    },
    close: async () => {
      await client.close();
    },
  };
}

export function createDatabaseConnection(databaseUrl: string): DatabaseConnection {
  if (databaseUrl.startsWith('pglite://')) {
    const rawTarget = databaseUrl.replace(/^pglite:\/\//, '');
    const dataDir = rawTarget === 'memory' || rawTarget === '' ? undefined : rawTarget;
    const client = new PGlite({
      dataDir,
      extensions: { vector },
    });
    const db = drizzlePglite(client, { schema });
    return {
      db,
      execSql: async (sqlText: string) => {
        await client.exec(sqlText);
      },
      close: async () => {
        await client.close();
      },
    };
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
    connectionTimeoutMillis: 3000,
  });

  const db = drizzleNodePg(pool, { schema });

  return {
    db,
    execSql: async (sqlText: string) => {
      await pool.query(sqlText);
    },
    close: async () => {
      await pool.end();
    },
  };
}

export async function createResilientDatabaseConnection(
  databaseUrl: string,
  fallbackPgliteDir = '.cache/pglite-db',
): Promise<DatabaseConnection> {
  if (databaseUrl.startsWith('pglite://')) {
    const conn = createDatabaseConnection(databaseUrl);
    await conn.execSql(getInitialMigrationSql());
    return conn;
  }

  const pgConn = createDatabaseConnection(databaseUrl);
  try {
    await pgConn.execSql('SELECT 1;');
    return pgConn;
  } catch {
    await pgConn.close().catch(() => undefined);
    const pgliteConn = await createPgliteConnection(fallbackPgliteDir);
    await pgliteConn.execSql(getInitialMigrationSql());
    return pgliteConn;
  }
}

export async function applyMigrationsOnConnection(
  conn: DatabaseConnection,
  direction: 'up' | 'down' = 'up',
): Promise<void> {
  const sqlText = direction === 'down' ? getDownMigrationSql() : getInitialMigrationSql();
  await conn.execSql(sqlText);
}

import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
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
  if (dataDir && dataDir !== 'memory') {
    const fs = await import('node:fs');
    fs.mkdirSync(dataDir, { recursive: true });
    const lockFile = join(dataDir, 'postmaster.pid');
    if (existsSync(lockFile)) {
      try {
        unlinkSync(lockFile);
      } catch {
        // ignore if cannot unlink
      }
    }
  }

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
    if (dataDir) {
      const lockFile = join(dataDir, 'postmaster.pid');
      if (existsSync(lockFile)) {
        try {
          unlinkSync(lockFile);
        } catch {
          // ignore if cannot unlink
        }
      }
    }
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

  const requiresSsl =
    databaseUrl.includes('sslmode=require') ||
    databaseUrl.includes('sslmode=verify-full') ||
    databaseUrl.includes('rds.amazonaws.com');

  let sanitizedUrl = databaseUrl;
  if (requiresSsl) {
    try {
      const parsed = new URL(databaseUrl);
      parsed.searchParams.delete('sslmode');
      sanitizedUrl = parsed.toString();
    } catch {
      sanitizedUrl = databaseUrl.replace(/[?&]sslmode=[^&]+/, '');
    }
  }

  const pool = new pg.Pool({
    connectionString: sanitizedUrl,
    max: 10,
    connectionTimeoutMillis: 5000,
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
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

  let pgConn = createDatabaseConnection(databaseUrl);
  try {
    await pgConn.execSql('SELECT 1;');
    await pgConn.execSql(getInitialMigrationSql());
    return pgConn;
  } catch (err: any) {
    if (err && typeof err === 'object' && err.code === '3D000') {
      try {
        const requiresSsl =
          databaseUrl.includes('sslmode=require') ||
          databaseUrl.includes('sslmode=verify-full') ||
          databaseUrl.includes('rds.amazonaws.com');
        const adminUrlObj = new URL(databaseUrl);
        const targetDbName = adminUrlObj.pathname.replace(/^\//, '');
        adminUrlObj.pathname = '/postgres';
        adminUrlObj.searchParams.delete('sslmode');
        const adminPool = new pg.Pool({
          connectionString: adminUrlObj.toString(),
          max: 2,
          connectionTimeoutMillis: 5000,
          ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
        });
        const safeDbName = targetDbName.replace(/[^a-zA-Z0-9_]/g, '');
        await adminPool.query(`CREATE DATABASE "${safeDbName}";`);
        await adminPool.end();
        console.log(`Successfully auto-created database "${safeDbName}" on RDS!`);

        pgConn = createDatabaseConnection(databaseUrl);
        await pgConn.execSql('SELECT 1;');
        await pgConn.execSql(getInitialMigrationSql());
        return pgConn;
      } catch (adminErr) {
        console.error('Failed to auto-create database via admin connection:', adminErr);
      }
    }

    if (process.env.NODE_ENV === 'production' && !databaseUrl.startsWith('pglite://')) {
      console.error('Failed to connect to primary PostgreSQL database in production:', err);
    }
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

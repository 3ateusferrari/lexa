import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  applyMigrationsOnConnection,
  createDatabaseConnection,
  createPgliteConnection,
  type DatabaseConnection,
} from '../../src/modules/db/client.js';

export interface IntegrationDbContext {
  connectionUri: string;
  conn: DatabaseConnection;
  runtime: 'testcontainers' | 'pglite' | 'external-postgres';
  teardown: () => Promise<void>;
}

export async function startPostgresTestContainer(): Promise<IntegrationDbContext> {
  let container: StartedPostgreSqlContainer | undefined;
  const externalUri = process.env.TEST_DATABASE_URL;

  if (externalUri) {
    const conn = createDatabaseConnection(externalUri);
    await applyMigrationsOnConnection(conn, 'down');
    await applyMigrationsOnConnection(conn, 'up');
    return {
      connectionUri: externalUri,
      conn,
      runtime: 'external-postgres',
      teardown: async () => {
        await conn.close();
      },
    };
  }

  try {
    container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
      .withDatabase('lexa_test')
      .withUsername('lexa')
      .withPassword('lexa_test_pass')
      .start();
    const connectionUri = container.getConnectionUri();
    const conn = createDatabaseConnection(connectionUri);
    await applyMigrationsOnConnection(conn, 'down');
    await applyMigrationsOnConnection(conn, 'up');

    return {
      connectionUri,
      conn,
      runtime: 'testcontainers',
      teardown: async () => {
        await conn.close();
        if (container) {
          await container.stop();
        }
      },
    };
  } catch {
    // Fallback to embedded PostgreSQL 16 + pgvector (PGlite WASM) when local Docker daemon is offline
    const conn = await createPgliteConnection();
    await applyMigrationsOnConnection(conn, 'down');
    await applyMigrationsOnConnection(conn, 'up');

    return {
      connectionUri: 'pglite://memory',
      conn,
      runtime: 'pglite',
      teardown: async () => {
        await conn.close();
      },
    };
  }
}

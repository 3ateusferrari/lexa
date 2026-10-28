import 'dotenv/config';
import { createResilientDatabaseConnection } from '../db/client.js';
import { parseEnv } from '../shared/env.js';
import { createApp } from './app.js';

async function main() {
  const env = parseEnv();
  const conn = await createResilientDatabaseConnection(env.DATABASE_URL);
  const app = createApp({ db: conn.db });

  const server = app.listen(env.PORT, () => {
    console.log(`Lexa API listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await conn.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

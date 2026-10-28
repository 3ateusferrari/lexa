import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getInitialMigrationSql(): string {
  return readFileSync(resolve(__dirname, 'migrations/0000_initial_schema.sql'), 'utf8');
}

export function getDownMigrationSql(): string {
  return [
    'DROP TABLE IF EXISTS eval_runs CASCADE;',
    'DROP TABLE IF EXISTS eval_questions CASCADE;',
    'DROP TABLE IF EXISTS ingestion_jobs CASCADE;',
    'DROP TABLE IF EXISTS chunks CASCADE;',
    'DROP TABLE IF EXISTS documents CASCADE;',
  ].join('\n');
}

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  doc_type      text NOT NULL,
  source_url    text,
  downloaded_at date,
  content_hash  text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  position     int  NOT NULL,
  article      text,
  section_path text,
  page         int,
  content      text NOT NULL,
  embedding    vector(384),
  tsv          tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', content)) STORED
);

CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks (document_id);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx   ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS chunks_tsv_idx         ON chunks USING gin (tsv);

CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  status      text NOT NULL,
  attempts    int  NOT NULL DEFAULT 0,
  error       text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eval_questions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question         text NOT NULL,
  expected_article text,
  document_id      uuid REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS eval_runs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  git_sha    text NOT NULL,
  config     jsonb NOT NULL,
  hit_rate   real NOT NULL,
  mrr        real NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

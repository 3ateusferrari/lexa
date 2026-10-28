import { describe, expect, it } from 'vitest';
import { parseEnv } from '../env.js';

describe('parseEnv', () => {
  it('parses valid environment variables and applies defaults', () => {
    const config = parseEnv({
      DATABASE_URL: 'postgresql://lexa:pass@localhost:5432/lexa_db',
      ANTHROPIC_API_KEY: 'sk-ant-test',
    });

    expect(config.DATABASE_URL).toBe('postgresql://lexa:pass@localhost:5432/lexa_db');
    expect(config.PORT).toBe(3000);
    expect(config.LOCAL_EMBEDDING_MODEL).toBe('Xenova/multilingual-e5-small');
    expect(config.EMBEDDING_DIMENSION).toBe(384);
    expect(config.ANTHROPIC_MODEL).toBe('claude-3-5-haiku-latest');
    expect(config.MAX_DAILY_LLM_CALLS).toBe(200);
  });

  it('throws a validation error when DATABASE_URL is missing', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});

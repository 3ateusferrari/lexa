import { describe, expect, it, vi } from 'vitest';
import type { DbClient } from '../../db/client.js';
import { vectorSearch } from '../vector-search.js';

describe('vectorSearch guard against malformed embeddings', () => {
  it('returns empty array without querying database if queryEmbedding is empty or invalid', async () => {
    const mockDb = {
      execute: vi.fn(),
    } as unknown as DbClient;

    const emptyRes = await vectorSearch(mockDb, []);
    expect(emptyRes).toEqual([]);
    expect(mockDb.execute).not.toHaveBeenCalled();

    const nanRes = await vectorSearch(mockDb, [NaN, 0.1, 0.2]);
    expect(nanRes).toEqual([]);
    expect(mockDb.execute).not.toHaveBeenCalled();

    const infRes = await vectorSearch(mockDb, [Infinity, 0.1]);
    expect(infRes).toEqual([]);
    expect(mockDb.execute).not.toHaveBeenCalled();
  });
});

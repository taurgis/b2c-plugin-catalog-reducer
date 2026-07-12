import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it} from 'vitest';

import * as selectionCache from './selectionCache';

describe('selectionCache', () => {
  const tempDirs: string[] = [];

  const withTempInputFile = async (): Promise<string> => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-selection-cache-'));
    tempDirs.push(tempDir);

    const inputFilename = path.join(tempDir, 'input.xml');
    await fs.writeFile(inputFilename, '<catalog></catalog>', 'utf8');

    return inputFilename;
  };

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, {recursive: true, force: true})));
  });

  it('computeCacheKey returns null when the input file does not exist', async () => {
    const cacheKey = await selectionCache.computeCacheKey('/nonexistent/input.xml', {});

    expect(cacheKey).toBeNull();
  });

  it('computeCacheKey changes when the selector config changes', async () => {
    const inputFilename = await withTempInputFile();

    const keyA = await selectionCache.computeCacheKey(inputFilename, {total: 1});
    const keyB = await selectionCache.computeCacheKey(inputFilename, {total: 2});

    expect(keyA).not.toBe(keyB);
  });

  it('computeCacheKey changes when the input file content changes', async () => {
    const inputFilename = await withTempInputFile();
    const selectorConfig = {total: 1};

    const keyBefore = await selectionCache.computeCacheKey(inputFilename, selectorConfig);

    await new Promise(resolve => setTimeout(resolve, 5));
    await fs.writeFile(inputFilename, '<catalog></catalog><!-- changed -->', 'utf8');

    const keyAfter = await selectionCache.computeCacheKey(inputFilename, selectorConfig);

    expect(keyBefore).not.toBe(keyAfter);
  });

  it('computeCacheKey is unchanged when the file is rewritten with identical content (mtime is not the signal)', async () => {
    const inputFilename = await withTempInputFile();
    const selectorConfig = {total: 1};

    const keyBefore = await selectionCache.computeCacheKey(inputFilename, selectorConfig);

    await new Promise(resolve => setTimeout(resolve, 5));
    await fs.writeFile(inputFilename, '<catalog></catalog>', 'utf8');

    const keyAfter = await selectionCache.computeCacheKey(inputFilename, selectorConfig);

    expect(keyBefore).toBe(keyAfter);
  });

  it('readCachedSelection returns null when nothing has been cached yet', async () => {
    const inputFilename = await withTempInputFile();
    const cacheKey = await selectionCache.computeCacheKey(inputFilename, {total: 1});

    const cached = await selectionCache.readCachedSelection(inputFilename, cacheKey);

    expect(cached).toBeNull();
  });

  it('readCachedSelection returns null for a null cache key without touching disk', async () => {
    const cached = await selectionCache.readCachedSelection('/nonexistent/input.xml', null);

    expect(cached).toBeNull();
  });

  it('writeCachedSelection persists a selection next to the input file, and readCachedSelection retrieves it', async () => {
    const inputFilename = await withTempInputFile();
    const selectorConfig = {total: 1};
    const cacheKey = await selectionCache.computeCacheKey(inputFilename, selectorConfig);
    const selection = [{$attrs: {'product-id': 'CACHED-1'}}];

    await selectionCache.writeCachedSelection(inputFilename, cacheKey, selection);

    const cacheDir = path.join(path.dirname(inputFilename), selectionCache.CACHE_DIR_NAME);
    const cacheEntries = await fs.readdir(cacheDir);
    expect(cacheEntries).toHaveLength(1);

    const cached = await selectionCache.readCachedSelection(inputFilename, cacheKey);
    expect(cached).toEqual(selection);
  });

  it('writeCachedSelection is a no-op for a null cache key', async () => {
    const inputFilename = await withTempInputFile();

    await selectionCache.writeCachedSelection(inputFilename, null, [{$attrs: {'product-id': 'X'}}]);

    const cacheDirExists = await fs.access(path.join(path.dirname(inputFilename), selectionCache.CACHE_DIR_NAME))
      .then(() => true)
      .catch(() => false);

    expect(cacheDirExists).toBe(false);
  });
});

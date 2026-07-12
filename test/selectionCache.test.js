const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const selectionCache = require('../lib/selectionCache');

const withTempInputFile = async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-selection-cache-'));

    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'input.xml');
    await fs.writeFile(inputFilename, '<catalog></catalog>', 'utf8');

    return inputFilename;
};

test('computeCacheKey returns null when the input file does not exist', async () => {
    const cacheKey = await selectionCache.computeCacheKey('/nonexistent/input.xml', {});

    assert.equal(cacheKey, null);
});

test('computeCacheKey changes when the selector config changes', async t => {
    const inputFilename = await withTempInputFile(t);

    const keyA = await selectionCache.computeCacheKey(inputFilename, { total: 1 });
    const keyB = await selectionCache.computeCacheKey(inputFilename, { total: 2 });

    assert.notEqual(keyA, keyB);
});

test('computeCacheKey changes when the input file content changes', async t => {
    const inputFilename = await withTempInputFile(t);
    const selectorConfig = { total: 1 };

    const keyBefore = await selectionCache.computeCacheKey(inputFilename, selectorConfig);

    await new Promise(resolve => setTimeout(resolve, 5));
    await fs.writeFile(inputFilename, '<catalog></catalog><!-- changed -->', 'utf8');

    const keyAfter = await selectionCache.computeCacheKey(inputFilename, selectorConfig);

    assert.notEqual(keyBefore, keyAfter);
});

test('computeCacheKey is unchanged when the file is rewritten with identical content (mtime is not the signal)', async t => {
    const inputFilename = await withTempInputFile(t);
    const selectorConfig = { total: 1 };

    const keyBefore = await selectionCache.computeCacheKey(inputFilename, selectorConfig);

    await new Promise(resolve => setTimeout(resolve, 5));
    await fs.writeFile(inputFilename, '<catalog></catalog>', 'utf8');

    const keyAfter = await selectionCache.computeCacheKey(inputFilename, selectorConfig);

    assert.equal(keyBefore, keyAfter);
});

test('readCachedSelection returns null when nothing has been cached yet', async t => {
    const inputFilename = await withTempInputFile(t);
    const cacheKey = await selectionCache.computeCacheKey(inputFilename, { total: 1 });

    const cached = await selectionCache.readCachedSelection(inputFilename, cacheKey);

    assert.equal(cached, null);
});

test('readCachedSelection returns null for a null cache key without touching disk', async () => {
    const cached = await selectionCache.readCachedSelection('/nonexistent/input.xml', null);

    assert.equal(cached, null);
});

test('writeCachedSelection persists a selection next to the input file, and readCachedSelection retrieves it', async t => {
    const inputFilename = await withTempInputFile(t);
    const selectorConfig = { total: 1 };
    const cacheKey = await selectionCache.computeCacheKey(inputFilename, selectorConfig);
    const selection = [{ $attrs: { 'product-id': 'CACHED-1' } }];

    await selectionCache.writeCachedSelection(inputFilename, cacheKey, selection);

    const cacheDir = path.join(path.dirname(inputFilename), selectionCache.CACHE_DIR_NAME);
    const cacheEntries = await fs.readdir(cacheDir);
    assert.equal(cacheEntries.length, 1);

    const cached = await selectionCache.readCachedSelection(inputFilename, cacheKey);
    assert.deepEqual(cached, selection);
});

test('writeCachedSelection is a no-op for a null cache key', async t => {
    const inputFilename = await withTempInputFile(t);

    await selectionCache.writeCachedSelection(inputFilename, null, [{ $attrs: { 'product-id': 'X' } }]);

    const cacheDirExists = await fs.access(path.join(path.dirname(inputFilename), selectionCache.CACHE_DIR_NAME))
        .then(() => true)
        .catch(() => false);

    assert.equal(cacheDirExists, false);
});

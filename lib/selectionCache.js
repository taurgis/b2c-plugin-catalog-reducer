const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fsPromises = require('fs/promises');

const CACHE_DIR_NAME = '.catalog-reducer-cache';
const CACHE_VERSION = '2';

/**
 * Hash the full contents of a file. Streamed rather than loaded into memory
 * so it stays cheap even for the multi-gigabyte catalog exports this tool
 * targets (well under a second per GB in practice) - hashing mtime/size
 * instead would be faster still, but can't tell a real content change from a
 * copy that happens to preserve the same size and a coarse-grained mtime.
 *
 * @param {string} inputFilename - Path to the file to hash.
 * @return {Promise<string>}
 */
const hashFileContents = inputFilename => new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(inputFilename);

    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
});

/**
 * Compute a cache key for a product selection, derived from the input
 * file's content hash plus the effective selector config. Any change to
 * either invalidates the cache automatically; there is nothing to clean up
 * manually. Returns null (never throws) if the input file cannot be read,
 * so callers can treat caching as a best-effort optimization.
 *
 * @param {string} inputFilename - Path to the source catalog XML file.
 * @param {Object} selectorConfig - The effective selector config for the run.
 * @return {Promise<string|null>}
 */
const computeCacheKey = async (inputFilename, selectorConfig) => {
    try {
        const contentHash = await hashFileContents(inputFilename);
        const fingerprint = JSON.stringify({
            version: CACHE_VERSION,
            inputFilename: path.resolve(inputFilename),
            contentHash,
            selectorConfig
        });

        return crypto.createHash('sha1').update(fingerprint).digest('hex');
    } catch {
        return null;
    }
};

// The cache lives next to the source catalog file rather than in the
// process's working directory, so it stays scoped to the data it was
// derived from regardless of where the CLI is invoked from.
const resolveCachePath = (inputFilename, cacheKey) => {
    const cacheDir = path.resolve(path.dirname(path.resolve(inputFilename)), CACHE_DIR_NAME);

    return path.join(cacheDir, `selection-${cacheKey}.json`);
};

/**
 * Read a previously cached product selection, if present and valid.
 *
 * @param {string} inputFilename - Path to the source catalog XML file.
 * @param {string} cacheKey - Key returned by computeCacheKey.
 * @return {Promise<Array<Object>|null>}
 */
const readCachedSelection = async (inputFilename, cacheKey) => {
    if (!cacheKey) {
        return null;
    }

    try {
        const contents = await fsPromises.readFile(resolveCachePath(inputFilename, cacheKey), 'utf8');

        return JSON.parse(contents);
    } catch {
        return null;
    }
};

/**
 * Persist a product selection to the cache. Failures are ignored since
 * caching is a best-effort optimization and must never fail the run.
 *
 * @param {string} inputFilename - Path to the source catalog XML file.
 * @param {string} cacheKey - Key returned by computeCacheKey.
 * @param {Array<Object>} selectedProducts - The selection to cache.
 * @return {Promise<void>}
 */
const writeCachedSelection = async (inputFilename, cacheKey, selectedProducts) => {
    if (!cacheKey) {
        return;
    }

    try {
        const cachePath = resolveCachePath(inputFilename, cacheKey);
        await fsPromises.mkdir(path.dirname(cachePath), { recursive: true });
        await fsPromises.writeFile(cachePath, JSON.stringify(selectedProducts));
    } catch {
        // Ignore cache write errors; caching is a best-effort optimization.
    }
};

module.exports = {
    CACHE_DIR_NAME,
    computeCacheKey,
    readCachedSelection,
    writeCachedSelection
};

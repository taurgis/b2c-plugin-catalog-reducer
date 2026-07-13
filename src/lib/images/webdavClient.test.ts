import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it, vi} from 'vitest';

import {createSdkWebdavImageClient} from './webdavClient';

describe('createSdkWebdavImageClient', () => {
  const tempDirs: string[] = [];

  const withTempDir = async (): Promise<string> => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-webdav-client-'));
    tempDirs.push(tempDir);

    return tempDir;
  };

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, {recursive: true, force: true})));
  });

  it('downloads the remote path and writes its content to the local path', async () => {
    const tempDir = await withTempDir();
    const localPath = path.join(tempDir, 'large.jpg');
    const get = vi.fn().mockResolvedValue(new TextEncoder().encode('image-bytes').buffer);
    const client = createSdkWebdavImageClient({webdav: {get}});

    await client.download('Libraries/mylibrary/default/large.jpg', localPath);

    expect(get).toHaveBeenCalledWith('Libraries/mylibrary/default/large.jpg');
    await expect(fs.readFile(localPath, 'utf8')).resolves.toBe('image-bytes');
  });

  it('sanitizes credential values before rethrowing a failed download', async () => {
    const tempDir = await withTempDir();
    const localPath = path.join(tempDir, 'large.jpg');
    const get = vi.fn().mockRejectedValue(new Error('401 Unauthorized: Authorization: Basic ZmFrZTpzZWNyZXQ='));
    const client = createSdkWebdavImageClient({webdav: {get}});

    await expect(client.download('path.jpg', localPath)).rejects.toThrow(/\[REDACTED\]/);

    try {
      await client.download('path.jpg', localPath);
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain('ZmFrZTpzZWNyZXQ=');
    }
  });
});

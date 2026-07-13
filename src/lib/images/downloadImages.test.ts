import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it, vi} from 'vitest';

import {downloadImages} from './downloadImages';
import {ImageDownloadJob, WebdavImageClient} from './types';

describe('downloadImages', () => {
  const tempDirs: string[] = [];

  const withTempDir = async (): Promise<string> => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-download-images-'));
    tempDirs.push(tempDir);

    return tempDir;
  };

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, {recursive: true, force: true})));
  });

  it('downloads every job and reports a fully-succeeded summary', async () => {
    const tempDir = await withTempDir();
    const jobs: ImageDownloadJob[] = [
      {imagePath: '/a/1.jpg', localPath: path.join(tempDir, 'a', '1.jpg'), remotePath: 'lib/a/1.jpg'},
      {imagePath: '/a/2.jpg', localPath: path.join(tempDir, 'a', '2.jpg'), remotePath: 'lib/a/2.jpg'}
    ];
    const download = vi.fn().mockResolvedValue(undefined);
    const client: WebdavImageClient = {download};

    const summary = await downloadImages(jobs, client, {concurrency: 2});

    expect(summary).toEqual({failed: 0, failures: [], succeeded: 2, total: 2});
    expect(download).toHaveBeenCalledTimes(2);
    expect(download).toHaveBeenCalledWith('lib/a/1.jpg', path.join(tempDir, 'a', '1.jpg'));
  });

  it('creates the local directory for each job before downloading', async () => {
    const tempDir = await withTempDir();
    const localPath = path.join(tempDir, 'nested', 'dir', '1.jpg');
    const download = vi.fn().mockResolvedValue(undefined);

    await downloadImages(
      [{imagePath: '/1.jpg', localPath, remotePath: 'lib/1.jpg'}],
      {download},
      {concurrency: 1}
    );

    await expect(fs.stat(path.dirname(localPath))).resolves.toBeTruthy();
  });

  it('continues remaining jobs after one fails and reports the sanitized failure', async () => {
    const tempDir = await withTempDir();
    const jobs: ImageDownloadJob[] = [
      {imagePath: '/a/1.jpg', localPath: path.join(tempDir, '1.jpg'), remotePath: 'lib/1.jpg'},
      {imagePath: '/a/2.jpg', localPath: path.join(tempDir, '2.jpg'), remotePath: 'lib/2.jpg'},
      {imagePath: '/a/3.jpg', localPath: path.join(tempDir, '3.jpg'), remotePath: 'lib/3.jpg'}
    ];
    const download = vi.fn().mockImplementation(async (remotePath: string) => {
      if (remotePath === 'lib/2.jpg') {
        throw new Error('401 Unauthorized: Authorization: Basic ZmFrZTpzZWNyZXQ=');
      }
    });

    const summary = await downloadImages(jobs, {download}, {concurrency: 3});

    expect(download).toHaveBeenCalledTimes(3);
    expect(summary.total).toBe(3);
    expect(summary.succeeded).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.failures).toEqual([{imagePath: '/a/2.jpg', message: expect.stringContaining('[REDACTED]')}]);
    expect(summary.failures[0].message).not.toContain('ZmFrZTpzZWNyZXQ=');
  });

  it('resolves an empty summary for an empty job list', async () => {
    const download = vi.fn();

    const summary = await downloadImages([], {download}, {concurrency: 4});

    expect(summary).toEqual({failed: 0, failures: [], succeeded: 0, total: 0});
    expect(download).not.toHaveBeenCalled();
  });
});

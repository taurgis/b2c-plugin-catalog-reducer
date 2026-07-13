import path from 'node:path';

import {describe, expect, it} from 'vitest';

import {joinWebdavPath, toLocalFilePath} from './webdavPath';

describe('joinWebdavPath', () => {
  it('joins a base without a trailing slash and a path without a leading slash', () => {
    expect(joinWebdavPath('mylibrary/default', 'large/a.jpg')).toBe('mylibrary/default/large/a.jpg');
  });

  it('normalizes a trailing slash on the base and a leading slash on the image path', () => {
    expect(joinWebdavPath('mylibrary/default/', '/large/a.jpg')).toBe('mylibrary/default/large/a.jpg');
  });

  it('normalizes multiple leading/trailing slashes on both sides', () => {
    expect(joinWebdavPath('mylibrary/default//', '//large/a.jpg')).toBe('mylibrary/default/large/a.jpg');
  });

  it('returns just the image path when the library path is empty', () => {
    expect(joinWebdavPath('', '/large/a.jpg')).toBe('large/a.jpg');
  });

  it('returns just the library path when the image path is empty', () => {
    expect(joinWebdavPath('mylibrary/default', '')).toBe('mylibrary/default');
  });
});

describe('toLocalFilePath', () => {
  const outputDir = '/tmp/catalog-images';

  it('mirrors the image path structure under the output directory', () => {
    expect(toLocalFilePath(outputDir, '/021006/01/fnd/large.jpg')).toBe(
      path.join(outputDir, '021006', '01', 'fnd', 'large.jpg')
    );
  });

  it('strips a leading slash so it cannot escape the output directory', () => {
    expect(toLocalFilePath(outputDir, '/a/b.jpg')).toBe(path.join(outputDir, 'a', 'b.jpg'));
  });

  it('rejects parent-directory traversal segments, keeping the result under outputDir', () => {
    const result = toLocalFilePath(outputDir, '../../etc/passwd');

    expect(result.startsWith(outputDir)).toBe(true);
    expect(result).toBe(path.join(outputDir, 'etc', 'passwd'));
  });

  it('ignores empty and current-directory segments from repeated slashes', () => {
    expect(toLocalFilePath(outputDir, '//a//./b.jpg')).toBe(path.join(outputDir, 'a', 'b.jpg'));
  });
});

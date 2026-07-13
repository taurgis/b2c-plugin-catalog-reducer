import path from 'node:path';

import {describe, expect, it} from 'vitest';

import {buildDownloadJobs} from './buildDownloadJobs';
import {ImageManifest} from './types';

const manifestWith = (uniqueImagePaths: string[]): ImageManifest => ({
  entries: [],
  productCount: 0,
  productsWithImages: 0,
  uniqueImagePaths
});

describe('buildDownloadJobs', () => {
  it('builds one job per unique image path, prefixed with the Libraries WebDAV root', () => {
    const jobs = buildDownloadJobs(manifestWith(['/a/1.jpg', '/a/2.jpg']), {
      libraryPath: 'mylibrary/default',
      outputDir: '/tmp/out'
    });

    expect(jobs).toEqual([
      {
        imagePath: '/a/1.jpg',
        localPath: path.join('/tmp/out', 'a', '1.jpg'),
        remotePath: 'Libraries/mylibrary/default/a/1.jpg'
      },
      {
        imagePath: '/a/2.jpg',
        localPath: path.join('/tmp/out', 'a', '2.jpg'),
        remotePath: 'Libraries/mylibrary/default/a/2.jpg'
      }
    ]);
  });

  it('normalizes slashes between the library path and the image path', () => {
    const jobs = buildDownloadJobs(manifestWith(['/a/1.jpg']), {
      libraryPath: 'mylibrary/default/',
      outputDir: '/tmp/out'
    });

    expect(jobs[0].remotePath).toBe('Libraries/mylibrary/default/a/1.jpg');
  });

  it('returns an empty array for a manifest with no images', () => {
    expect(buildDownloadJobs(manifestWith([]), {libraryPath: 'lib', outputDir: '/tmp'})).toEqual([]);
  });
});

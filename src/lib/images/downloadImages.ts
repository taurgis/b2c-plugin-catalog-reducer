import fs from 'node:fs/promises';
import path from 'node:path';

import {runWithConcurrency} from './downloadPool';
import {sanitizeErrorMessage} from './redact';
import {DownloadSummary, ImageDownloadJob, WebdavImageClient} from './types';

export interface DownloadImagesOptions {
  concurrency: number;
}

export const downloadImages = async (
  jobs: ImageDownloadJob[],
  client: WebdavImageClient,
  options: DownloadImagesOptions
): Promise<DownloadSummary> => {
  const failures = await runWithConcurrency(jobs, options.concurrency, async job => {
    await fs.mkdir(path.dirname(job.localPath), {recursive: true});
    await client.download(job.remotePath, job.localPath);
  });

  return {
    failed: failures.length,
    failures: failures.map(failure => ({
      imagePath: failure.item.imagePath,
      message: sanitizeErrorMessage(failure.error)
    })),
    succeeded: jobs.length - failures.length,
    total: jobs.length
  };
};

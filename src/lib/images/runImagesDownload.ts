import {Logger} from '../types';
import {buildDownloadJobs} from './buildDownloadJobs';
import {downloadImages} from './downloadImages';
import {buildImageManifest} from './imageManifest';
import {createLiveWebdavInstance} from './sdkInstance';
import {DownloadSummary} from './types';
import {createSdkWebdavImageClient} from './webdavClient';

const DRY_RUN_PREVIEW_LIMIT = 5;

const defaultLogger: Logger = {
  info: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args)
};

export interface RunImagesDownloadOptions {
  concurrency: number;
  dryRun?: boolean;
  input: string;
  libraryPath: string;
  logger?: Logger;
  output: string;
}

export interface RunImagesDownloadResult {
  dryRun: boolean;
  summary?: DownloadSummary;
}

/**
 * Runs the `catalog images download` workflow: builds the image manifest
 * from an already-reduced catalog XML file, resolves download jobs, and
 * either previews them (dry run) or downloads them from a live sandbox.
 * Throws on any failure; never calls `process.exit`.
 */
export const runImagesDownload = async (options: RunImagesDownloadOptions): Promise<RunImagesDownloadResult> => {
  const logger = options.logger ?? defaultLogger;

  const manifest = await buildImageManifest(options.input);

  logger.info(
    `Found ${manifest.productsWithImages}/${manifest.productCount} products with images `
    + `(${manifest.uniqueImagePaths.length} unique image paths).`
  );

  const jobs = buildDownloadJobs(manifest, {libraryPath: options.libraryPath, outputDir: options.output});

  if (options.dryRun) {
    logger.info(`Dry run: would download ${jobs.length} image(s) to ${options.output}. No network calls made.`);
    jobs.slice(0, DRY_RUN_PREVIEW_LIMIT).forEach(job => logger.info(`  ${job.remotePath} -> ${job.localPath}`));

    if (jobs.length > DRY_RUN_PREVIEW_LIMIT) {
      logger.info(`  ... and ${jobs.length - DRY_RUN_PREVIEW_LIMIT} more`);
    }

    return {dryRun: true};
  }

  if (jobs.length === 0) {
    logger.info('No images to download.');
    return {dryRun: false};
  }

  const instance = await createLiveWebdavInstance();
  const client = createSdkWebdavImageClient(instance);
  const summary = await downloadImages(jobs, client, {concurrency: options.concurrency});

  logger.info(`Downloaded ${summary.succeeded}/${summary.total} image(s).`);
  summary.failures.forEach(failure => logger.warn(`Failed to download ${failure.imagePath}: ${failure.message}`));

  return {dryRun: false, summary};
};

import {ImageDownloadJob, ImageManifest} from './types';
import {joinWebdavPath, toLocalFilePath} from './webdavPath';

// Product/content asset libraries live under the `Libraries` WebDAV root, a
// stable B2C Commerce structural constant - not instance-specific like the
// library id/path segment underneath it (see BuildDownloadJobsOptions.libraryPath).
const WEBDAV_LIBRARIES_ROOT = 'Libraries';

export interface BuildDownloadJobsOptions {
  libraryPath: string;
  outputDir: string;
}

export const buildDownloadJobs = (
  manifest: ImageManifest,
  options: BuildDownloadJobsOptions
): ImageDownloadJob[] => manifest.uniqueImagePaths.map(imagePath => ({
  imagePath,
  localPath: toLocalFilePath(options.outputDir, imagePath),
  remotePath: `${WEBDAV_LIBRARIES_ROOT}/${joinWebdavPath(options.libraryPath, imagePath)}`
}));

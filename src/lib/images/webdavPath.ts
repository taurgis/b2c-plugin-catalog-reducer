import path from 'node:path';

const trimSlashes = (segment: string): string => segment.replace(/^\/+/, '').replace(/\/+$/, '');

export const joinWebdavPath = (libraryPath: string, imagePath: string): string => {
  const trimmedLibraryPath = trimSlashes(libraryPath);
  const trimmedImagePath = trimSlashes(imagePath);

  if (!trimmedLibraryPath) {
    return trimmedImagePath;
  }

  if (!trimmedImagePath) {
    return trimmedLibraryPath;
  }

  return `${trimmedLibraryPath}/${trimmedImagePath}`;
};

export const toLocalFilePath = (outputDir: string, imagePath: string): string => {
  const safeSegments = imagePath
    .split('/')
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0 && segment !== '.' && segment !== '..');

  return path.join(outputDir, ...safeSegments);
};

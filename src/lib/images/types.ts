export interface ImageManifestEntry {
  productId: string;
  imagePaths: string[];
}

export interface ImageManifest {
  entries: ImageManifestEntry[];
  uniqueImagePaths: string[];
  productCount: number;
  productsWithImages: number;
}

export interface ImageDownloadJob {
  imagePath: string;
  remotePath: string;
  localPath: string;
}

export interface WebdavImageClient {
  download(remotePath: string, localPath: string): Promise<void>;
}

export interface DownloadFailure {
  imagePath: string;
  message: string;
}

export interface DownloadSummary {
  total: number;
  succeeded: number;
  failed: number;
  failures: DownloadFailure[];
}

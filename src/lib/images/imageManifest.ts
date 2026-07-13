import {teardownProductStream} from '../filters/filter';
import {openProductStream} from '../productXmlStream';
import {XmlNode} from '../types';
import {collectProductImagePaths} from './collectImagePaths';
import {ImageManifest, ImageManifestEntry} from './types';

export const buildImageManifest = (inputFile: string): Promise<ImageManifest> => {
  return new Promise<ImageManifest>((resolve, reject) => {
    const streamHandle = openProductStream(inputFile);
    const {xml} = streamHandle;
    let isSettled = false;

    const entries: ImageManifestEntry[] = [];
    const uniqueImagePaths = new Set<string>();
    let productCount = 0;
    let productsWithImages = 0;

    const settle = (error?: unknown): void => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      teardownProductStream(streamHandle);

      if (error) {
        reject(error);
        return;
      }

      resolve({
        entries,
        productCount,
        productsWithImages,
        uniqueImagePaths: [...uniqueImagePaths]
      });
    };

    xml.on('tag:product', (product: XmlNode) => {
      try {
        productCount += 1;

        const {imagePaths, productId} = collectProductImagePaths(product);

        if (!productId || imagePaths.length === 0) {
          return;
        }

        productsWithImages += 1;
        entries.push({imagePaths, productId});
        imagePaths.forEach(path => uniqueImagePaths.add(path));
      } catch (error) {
        settle(error);
      }
    });

    xml.on('error', error => {
      settle(error);
    });

    xml.on('end', () => {
      settle();
    });
  });
};

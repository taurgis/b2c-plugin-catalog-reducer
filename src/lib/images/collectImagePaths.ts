import {XmlNode} from '../types';

const toArray = (value: unknown): any[] => {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

const extractPath = (image: any): string | undefined => {
  if (typeof image === 'string') {
    return image;
  }

  const path = image?.$attrs?.path;

  return typeof path === 'string' && path.length > 0 ? path : undefined;
};

export interface CollectedProductImagePaths {
  productId: string | null;
  imagePaths: string[];
}

export const collectProductImagePaths = (product: XmlNode): CollectedProductImagePaths => {
  const productId = product?.$attrs?.['product-id'];

  if (typeof productId !== 'string' || productId.length === 0) {
    return {imagePaths: [], productId: null};
  }

  const paths = new Set<string>();

  for (const group of toArray(product?.images)) {
    for (const image of toArray(group?.image)) {
      const path = extractPath(image);

      if (path) {
        paths.add(path);
      }
    }
  }

  return {imagePaths: [...paths], productId};
};

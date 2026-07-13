import {describe, expect, it} from 'vitest';

import {collectProductImagePaths} from './collectImagePaths';

describe('collectProductImagePaths', () => {
  it('returns no product id and no paths when product-id is missing', () => {
    const result = collectProductImagePaths({});

    expect(result).toEqual({imagePaths: [], productId: null});
  });

  it('returns no paths when the product has no images', () => {
    const result = collectProductImagePaths({$attrs: {'product-id': 'p1'}});

    expect(result).toEqual({imagePaths: [], productId: 'p1'});
  });

  it('extracts a single image path from a single image-group', () => {
    const product = {
      $attrs: {'product-id': 'p1'},
      images: {
        $attrs: {'view-type': 'large'},
        image: {$attrs: {path: '/a/large.jpg'}}
      }
    };

    expect(collectProductImagePaths(product)).toEqual({
      imagePaths: ['/a/large.jpg'],
      productId: 'p1'
    });
  });

  it('extracts multiple image paths from an array of images within one group', () => {
    const product = {
      $attrs: {'product-id': 'p1'},
      images: {
        $attrs: {'view-type': 'swatch'},
        image: [{$attrs: {path: '/a/1.jpg'}}, {$attrs: {path: '/a/2.jpg'}}]
      }
    };

    expect(collectProductImagePaths(product).imagePaths).toEqual(['/a/1.jpg', '/a/2.jpg']);
  });

  it('extracts image paths across multiple image-groups', () => {
    const product = {
      $attrs: {'product-id': 'p1'},
      images: [
        {$attrs: {'view-type': 'large'}, image: {$attrs: {path: '/a/large.jpg'}}},
        {$attrs: {'view-type': 'small'}, image: {$attrs: {path: '/a/small.jpg'}}}
      ]
    };

    expect(collectProductImagePaths(product).imagePaths).toEqual(['/a/large.jpg', '/a/small.jpg']);
  });

  it('dedupes a path repeated across multiple image-groups within the same product', () => {
    const product = {
      $attrs: {'product-id': 'p1'},
      images: [
        {$attrs: {'view-type': 'large'}, image: {$attrs: {path: '/a/shared.jpg'}}},
        {$attrs: {'view-type': 'zoom'}, image: {$attrs: {path: '/a/shared.jpg'}}}
      ]
    };

    expect(collectProductImagePaths(product).imagePaths).toEqual(['/a/shared.jpg']);
  });

  it('ignores image entries with a missing or empty path', () => {
    const product = {
      $attrs: {'product-id': 'p1'},
      images: {
        $attrs: {'view-type': 'large'},
        image: [{$attrs: {}}, {$attrs: {path: ''}}, {$attrs: {path: '/a/ok.jpg'}}]
      }
    };

    expect(collectProductImagePaths(product).imagePaths).toEqual(['/a/ok.jpg']);
  });
});

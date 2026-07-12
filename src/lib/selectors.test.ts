import {describe, expect, it} from 'vitest';

import * as selectors from './selectors';

describe('hasCustomAttribute', () => {
  it('returns false when custom attributes are missing', () => {
    const product = {
      $attrs: {
        'product-id': 'NO-ATTRS'
      }
    };

    expect(selectors.hasCustomAttribute(product, 'brand')).toBe(false);
  });

  it('matches attribute id without value', () => {
    const product = {
      'custom-attributes': [
        {
          $attrs: {
            'attribute-id': 'brand'
          },
          $text: 'Forward'
        }
      ]
    };

    expect(selectors.hasCustomAttribute(product, 'brand')).toBe(true);
  });

  it('matches attribute id and value', () => {
    const product = {
      'custom-attributes': [
        {
          $attrs: {
            'attribute-id': 'brand'
          },
          $text: 'Forward'
        },
        {
          $attrs: {
            'attribute-id': 'color'
          },
          $text: 'Black'
        }
      ]
    };

    expect(selectors.hasCustomAttribute(product, 'brand', 'Forward')).toBe(true);
    expect(selectors.hasCustomAttribute(product, 'brand', 'Other')).toBe(false);
  });
});

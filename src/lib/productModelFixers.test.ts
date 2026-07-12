import {describe, expect, it} from 'vitest';

import ProductModelFixers from './productModelFixers';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('ProductModelFixers', () => {
  it('fixOptions converts options to shared-option entries', () => {
    const product: any = {
      options: 'SIZE'
    };
    const modifiedProduct = clone(product);

    ProductModelFixers.fixOptions(product, modifiedProduct);

    expect(modifiedProduct.options).toEqual({
      'shared-option': [
        {
          $attrs: {
            'option-id': 'SIZE'
          }
        }
      ]
    });
  });

  it('fixOptions normalizes parser-shaped shared-option values', () => {
    const product: any = {
      options: {
        $attrs: {
          'option-id': 'consoleWarranty'
        }
      }
    };
    const modifiedProduct = clone(product);

    ProductModelFixers.fixOptions(product, modifiedProduct);

    expect(modifiedProduct.options).toEqual({
      'shared-option': [
        {
          $attrs: {
            'option-id': 'consoleWarranty'
          }
        }
      ]
    });
  });

  it('fixOptions is a no-op when the product has no options', () => {
    const product: any = {};
    const modifiedProduct: any = {};

    ProductModelFixers.fixOptions(product, modifiedProduct);

    expect(Object.prototype.hasOwnProperty.call(modifiedProduct, 'options')).toBe(false);
  });

  it('fixOptions resolves option ids from a bare option-id property', () => {
    const product: any = {
      options: {
        'option-id': 'plainShape'
      }
    };
    const modifiedProduct = clone(product);

    ProductModelFixers.fixOptions(product, modifiedProduct);

    expect(modifiedProduct.options).toEqual({
      'shared-option': [
        {
          $attrs: {
            'option-id': 'plainShape'
          }
        }
      ]
    });
  });

  it('fixOptions deletes options when no option ids can be resolved', () => {
    const product: any = {
      options: [{unrelated: true}]
    };
    const modifiedProduct = clone(product);

    ProductModelFixers.fixOptions(product, modifiedProduct);

    expect(Object.prototype.hasOwnProperty.call(modifiedProduct, 'options')).toBe(false);
  });

  it('fixCustomAttributes wraps custom attributes in custom-attribute key', () => {
    const product: any = {
      'custom-attributes': {
        $attrs: {
          'attribute-id': 'brand'
        },
        $text: 'Forward'
      }
    };
    const modifiedProduct = clone(product);

    ProductModelFixers.fixCustomAttributes(product, modifiedProduct);

    expect(modifiedProduct['custom-attributes']).toEqual({
      'custom-attribute': [
        {
          $attrs: {
            'attribute-id': 'brand'
          },
          $text: 'Forward'
        }
      ]
    });
  });

  it('fixPageAttributes preserves the page-attributes container and normalizes child arrays', () => {
    const product: any = {
      'page-attributes': {
        'page-title': {
          $attrs: {
            'xml:lang': 'x-default'
          },
          $text: 'Department'
        },
        'page-description': {
          $attrs: {
            'xml:lang': 'x-default'
          },
          $text: 'Department description'
        }
      }
    };
    const modifiedProduct = clone(product);

    ProductModelFixers.fixPageAttributes(product, modifiedProduct);

    expect(modifiedProduct['page-attributes']).toEqual({
      'page-title': [
        {
          $attrs: {
            'xml:lang': 'x-default'
          },
          $text: 'Department'
        }
      ],
      'page-description': [
        {
          $attrs: {
            'xml:lang': 'x-default'
          },
          $text: 'Department description'
        }
      ]
    });
  });

  it('fixProductSetProducts maps ids to product-set-product objects', () => {
    const product: any = {
      'product-set-products': ['SET-1', 'SET-2']
    };
    const modifiedProduct = clone(product);

    ProductModelFixers.fixProductSetProducts(product, modifiedProduct);

    expect(modifiedProduct['product-set-products']).toEqual({
      'product-set-product': [
        {
          $attrs: {
            'product-id': 'SET-1'
          }
        },
        {
          $attrs: {
            'product-id': 'SET-2'
          }
        }
      ]
    });
  });

  it('fixBundledProducts wraps bundled entries in bundled-product nodes', () => {
    const product: any = {
      'bundled-products': [
        {
          $attrs: {
            'product-id': 'BUNDLE-CHILD-1'
          },
          quantity: '1'
        },
        {
          $attrs: {
            'product-id': 'BUNDLE-CHILD-2'
          },
          quantity: {
            $text: '2'
          }
        }
      ]
    };
    const modifiedProduct = clone(product);

    ProductModelFixers.fixBundledProducts(product, modifiedProduct);

    expect(modifiedProduct['bundled-products']).toEqual({
      'bundled-product': [
        {
          $attrs: {
            'product-id': 'BUNDLE-CHILD-1'
          },
          quantity: '1'
        },
        {
          $attrs: {
            'product-id': 'BUNDLE-CHILD-2'
          },
          quantity: '2'
        }
      ]
    });
  });

  it('fixVariants removes invalid variations when required blocks are missing', () => {
    const product: any = {
      variations: {
        variants: {
          variant: {
            $attrs: {
              'product-id': 'VAR-001'
            }
          }
        }
      }
    };
    const modifiedProduct = clone(product);

    ProductModelFixers.fixVariants(product, modifiedProduct);

    expect(Object.prototype.hasOwnProperty.call(modifiedProduct, 'variations')).toBe(false);
  });

  it('fixVariants normalizes non-array variant values', () => {
    const product: any = {
      variations: {
        variants: 'VAR-001',
        attributes: {
          'variation-attribute': {
            'attribute-id': 'color',
            'variation-attribute-id': 'color'
          }
        }
      }
    };

    const modifiedProduct = clone(product);

    ProductModelFixers.fixVariants(product, modifiedProduct);

    expect(modifiedProduct.variations.variants).toEqual({
      variant: [
        {
          $attrs: {
            'product-id': 'VAR-001'
          }
        }
      ]
    });
  });

  it('fixVariants supports nested variation-group structures', () => {
    const product: any = {
      variations: {
        variants: [
          {
            $attrs: {
              'product-id': 'VAR-001'
            }
          }
        ],
        'variation-groups': {
          'variation-group': {
            $attrs: {
              'product-id': 'VG-001'
            }
          }
        },
        attributes: {
          'variation-attribute': {
            'attribute-id': 'size',
            'variation-attribute-id': 'size'
          }
        }
      }
    };

    const modifiedProduct = clone(product);

    ProductModelFixers.fixVariants(product, modifiedProduct);

    expect(modifiedProduct.variations['variation-groups']).toEqual({
      'variation-group': [
        {
          $attrs: {
            'product-id': 'VG-001'
          }
        }
      ]
    });
  });

  it('fixVariationAttributes normalizes variation-attribute-values payloads', () => {
    const product: any = {
      variations: {
        attributes: {
          'variation-attribute': {
            $attrs: {
              'attribute-id': 'color',
              'variation-attribute-id': 'color'
            },
            'variation-attribute-values': {
              $attrs: {
                value: 'red'
              },
              'display-value': 'Red'
            }
          }
        }
      }
    };
    const modifiedProduct: any = {
      variations: {
        variants: {
          variant: []
        },
        attributes: [
          {
            $attrs: {
              'attribute-id': 'color',
              'variation-attribute-id': 'color'
            },
            'variation-attribute-values': {
              $attrs: {
                value: 'red'
              },
              'display-value': 'Red'
            }
          }
        ]
      }
    };

    ProductModelFixers.fixVariationAttributes(product, modifiedProduct);

    expect(modifiedProduct.variations.attributes['variation-attribute']).toEqual([
      {
        $attrs: {
          'attribute-id': 'color',
          'variation-attribute-id': 'color'
        },
        'variation-attribute-values': {
          'variation-attribute-value': [
            {
              'display-value': 'Red',
              $attrs: {
                value: 'red'
              }
            }
          ]
        }
      }
    ]);
  });

  it('fixImages supports mixed image input structures', () => {
    const product: any = {
      images: [
        {
          $attrs: {
            'view-type': 'large'
          },
          variation: {
            'attribute-id': 'color',
            value: 'blue'
          },
          image: [
            'images/first.jpg',
            {
              $attrs: {
                path: 'images/second.jpg'
              }
            }
          ]
        },
        {
          $attrs: {
            'view-type': 'small'
          },
          image: {
            $attrs: {
              path: 'images/third.jpg'
            }
          }
        }
      ]
    };
    const modifiedProduct = clone(product);

    ProductModelFixers.fixImages(product, modifiedProduct);

    expect(modifiedProduct.images).toEqual({
      'image-group': [
        {
          $attrs: {
            'view-type': 'large'
          },
          variation: {
            $attrs: {
              'attribute-id': 'color',
              value: 'blue'
            }
          },
          image: [
            {
              $attrs: {
                path: 'images/first.jpg'
              }
            },
            {
              $attrs: {
                path: 'images/second.jpg'
              }
            }
          ]
        },
        {
          $attrs: {
            'view-type': 'small'
          },
          image: {
            $attrs: {
              path: 'images/third.jpg'
            }
          }
        }
      ]
    });
  });

  it('fixImages ignores malformed image entries without throwing', () => {
    const product: any = {
      images: [
        {
          $attrs: {
            'view-type': 'large'
          },
          image: null
        },
        {
          $attrs: {
            'view-type': 'small'
          },
          image: {
            unexpected: true
          }
        },
        {
          $attrs: {
            'view-type': 'swatch'
          },
          image: [
            null,
            'images/valid-a.jpg',
            {
              $attrs: {
                path: 'images/valid-b.jpg'
              }
            }
          ]
        }
      ]
    };
    const modifiedProduct = clone(product);

    expect(() => {
      ProductModelFixers.fixImages(product, modifiedProduct);
    }).not.toThrow();

    expect(modifiedProduct.images).toEqual({
      'image-group': [
        {
          $attrs: {
            'view-type': 'large'
          }
        },
        {
          $attrs: {
            'view-type': 'small'
          }
        },
        {
          $attrs: {
            'view-type': 'swatch'
          },
          image: [
            {
              $attrs: {
                path: 'images/valid-a.jpg'
              }
            },
            {
              $attrs: {
                path: 'images/valid-b.jpg'
              }
            }
          ]
        }
      ]
    });
  });

  it('fixImages preserves variation value from $attrs payloads', () => {
    const product: any = {
      images: [
        {
          $attrs: {
            'view-type': 'large-MEX'
          },
          variation: {
            $attrs: {
              'attribute-id': 'color',
              value: '01'
            }
          },
          image: {
            $attrs: {
              path: 'images/from-source-shape.jpg'
            }
          }
        }
      ]
    };
    const modifiedProduct = clone(product);

    ProductModelFixers.fixImages(product, modifiedProduct);

    expect(modifiedProduct.images).toEqual({
      'image-group': [
        {
          $attrs: {
            'view-type': 'large-MEX'
          },
          variation: {
            $attrs: {
              'attribute-id': 'color',
              value: '01'
            }
          },
          image: {
            $attrs: {
              path: 'images/from-source-shape.jpg'
            }
          }
        }
      ]
    });
  });

  it('fixImages omits undefined variation value attributes', () => {
    const product: any = {
      images: [
        {
          $attrs: {
            'view-type': 'swatch'
          },
          variation: {
            $attrs: {
              'attribute-id': 'color'
            }
          },
          image: 'images/swatch.jpg'
        }
      ]
    };
    const modifiedProduct = clone(product);

    ProductModelFixers.fixImages(product, modifiedProduct);

    expect(modifiedProduct.images).toEqual({
      'image-group': [
        {
          $attrs: {
            'view-type': 'swatch'
          },
          variation: {
            $attrs: {
              'attribute-id': 'color'
            }
          },
          image: {
            $attrs: {
              path: 'images/swatch.jpg'
            }
          }
        }
      ]
    });
  });

  it('fixDeprecatedElements strips the 4 deprecated store-*-flag elements', () => {
    const product: any = {
      'store-force-price-flag': {$text: 'false'},
      'store-non-inventory-flag': {$text: 'false'},
      'store-non-revenue-flag': {$text: 'false'},
      'store-non-discountable-flag': {$text: 'false'},
      'online-flag': {$text: 'true'},
      'store-attributes': {
        'force-price-flag': {$text: 'false'},
        'non-inventory-flag': {$text: 'false'},
        'non-revenue-flag': {$text: 'false'},
        'non-discountable-flag': {$text: 'false'}
      }
    };
    const modifiedProduct = clone(product);

    ProductModelFixers.fixDeprecatedElements(product, modifiedProduct);

    expect(Object.prototype.hasOwnProperty.call(modifiedProduct, 'store-force-price-flag')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(modifiedProduct, 'store-non-inventory-flag')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(modifiedProduct, 'store-non-revenue-flag')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(modifiedProduct, 'store-non-discountable-flag')).toBe(false);
    // Siblings, including the non-deprecated store-attributes equivalents, are untouched.
    expect(modifiedProduct['online-flag']).toEqual({$text: 'true'});
    expect(modifiedProduct['store-attributes']).toEqual(product['store-attributes']);
  });

  it('fixDeprecatedElements is a no-op when none of the deprecated elements are present', () => {
    const product: any = {'online-flag': {$text: 'true'}};
    const modifiedProduct = clone(product);

    ProductModelFixers.fixDeprecatedElements(product, modifiedProduct);

    expect(modifiedProduct).toEqual({'online-flag': {$text: 'true'}});
  });
});

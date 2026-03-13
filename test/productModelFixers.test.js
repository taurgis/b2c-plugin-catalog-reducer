const test = require('node:test');
const assert = require('node:assert/strict');

const ProductModelFixers = require('../lib/productModelFixers');

const clone = value => JSON.parse(JSON.stringify(value));

test('fixOptions converts options to shared-option entries', () => {
    const product = {
        options: 'SIZE'
    };
    const modifiedProduct = clone(product);

    ProductModelFixers.fixOptions(product, modifiedProduct);

    assert.deepEqual(modifiedProduct.options, {
        'shared-option': [
            {
                $attrs: {
                    'option-id': 'SIZE'
                }
            }
        ]
    });
});

test('fixCustomAttributes wraps custom attributes in custom-attribute key', () => {
    const product = {
        'custom-attributes': {
            $attrs: {
                'attribute-id': 'brand'
            },
            $text: 'Forward'
        }
    };
    const modifiedProduct = clone(product);

    ProductModelFixers.fixCustomAttributes(product, modifiedProduct);

    assert.deepEqual(modifiedProduct['custom-attributes'], {
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

test('fixPageAttributes normalizes page attributes to an array', () => {
    const product = {
        'page-attributes': {
            $attrs: {
                'attribute-id': 'department'
            }
        }
    };
    const modifiedProduct = clone(product);

    ProductModelFixers.fixPageAttributes(product, modifiedProduct);

    assert.deepEqual(modifiedProduct['page-attributes'], [
        {
            $attrs: {
                'attribute-id': 'department'
            }
        }
    ]);
});

test('fixProductSetProducts maps ids to product-set-product objects', () => {
    const product = {
        'product-set-products': ['SET-1', 'SET-2']
    };
    const modifiedProduct = clone(product);

    ProductModelFixers.fixProductSetProducts(product, modifiedProduct);

    assert.deepEqual(modifiedProduct['product-set-products'], {
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

test('fixVariants removes invalid variations when required blocks are missing', () => {
    const product = {
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

    assert.equal(Object.prototype.hasOwnProperty.call(modifiedProduct, 'variations'), false);
});

test('fixVariants normalizes non-array variant values', () => {
    const product = {
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

    assert.deepEqual(modifiedProduct.variations.variants, {
        variant: [
            {
                $attrs: {
                    'product-id': 'VAR-001'
                }
            }
        ]
    });
});

test('fixVariants supports nested variation-group structures', () => {
    const product = {
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

    assert.deepEqual(modifiedProduct.variations['variation-groups'], {
        'variation-group': [
            {
                $attrs: {
                    'product-id': 'VG-001'
                }
            }
        ]
    });
});

test('fixVariationAttributes normalizes variation-attribute-values payloads', () => {
    const product = {
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
    const modifiedProduct = {
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

    assert.deepEqual(modifiedProduct.variations.attributes['variation-attribute'], [
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

test('fixImages supports mixed image input structures', () => {
    const product = {
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

    assert.deepEqual(modifiedProduct.images, {
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

test('fixImages ignores malformed image entries without throwing', () => {
    const product = {
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

    assert.doesNotThrow(() => {
        ProductModelFixers.fixImages(product, modifiedProduct);
    });

    assert.deepEqual(modifiedProduct.images, {
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

test('fixImages preserves variation value from $attrs payloads', () => {
    const product = {
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

    assert.deepEqual(modifiedProduct.images, {
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

test('fixImages omits undefined variation value attributes', () => {
    const product = {
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

    assert.deepEqual(modifiedProduct.images, {
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

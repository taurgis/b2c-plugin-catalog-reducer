const test = require('node:test');
const assert = require('node:assert/strict');

const selectors = require('../lib/selectors');

test('hasCustomAttribute returns false when custom attributes are missing', () => {
    const product = {
        $attrs: {
            'product-id': 'NO-ATTRS'
        }
    };

    assert.equal(selectors.hasCustomAttribute(product, 'brand'), false);
});

test('hasCustomAttribute matches attribute id without value', () => {
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

    assert.equal(selectors.hasCustomAttribute(product, 'brand'), true);
});

test('hasCustomAttribute matches attribute id and value', () => {
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

    assert.equal(selectors.hasCustomAttribute(product, 'brand', 'Forward'), true);
    assert.equal(selectors.hasCustomAttribute(product, 'brand', 'Other'), false);
});

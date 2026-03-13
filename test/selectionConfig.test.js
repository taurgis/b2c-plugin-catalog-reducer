const test = require('node:test');
const assert = require('node:assert/strict');

const {
    canCaptureFillerDuringPreferredPass,
    hasAnySelectionTarget,
    hasCustomAttributeSelection,
    hasMasterSelection,
    hasPreferredProductIds
} = require('../lib/selectionConfig');

test('hasPreferredProductIds returns true only for non-empty arrays', () => {
    assert.equal(hasPreferredProductIds({ productIds: ['A'] }), true);
    assert.equal(hasPreferredProductIds({ productIds: [] }), false);
    assert.equal(hasPreferredProductIds({}), false);
});

test('hasCustomAttributeSelection returns true only for non-empty custom attribute arrays', () => {
    assert.equal(hasCustomAttributeSelection({ attributes: { custom: [{ id: 'brand', count: 1 }] } }), true);
    assert.equal(hasCustomAttributeSelection({ attributes: { custom: [] } }), false);
    assert.equal(hasCustomAttributeSelection({}), false);
});

test('selection target helpers detect total and master targets', () => {
    assert.equal(hasMasterSelection({ master: 1 }), true);
    assert.equal(hasMasterSelection({ master: 0 }), false);
    assert.equal(hasAnySelectionTarget({ total: 1, master: 0, productIds: [] }), true);
    assert.equal(hasAnySelectionTarget({ total: 0, master: 1, productIds: [] }), true);
    assert.equal(hasAnySelectionTarget({ total: 0, master: 0, productIds: ['A'] }), true);
    assert.equal(hasAnySelectionTarget({ total: 0, master: 0, productIds: [] }), false);
});

test('canCaptureFillerDuringPreferredPass is disabled when custom attributes are configured', () => {
    assert.equal(canCaptureFillerDuringPreferredPass({ productIds: ['A'], attributes: { custom: [] } }), true);
    assert.equal(canCaptureFillerDuringPreferredPass({ master: 1, attributes: { custom: [] } }), true);
    assert.equal(
        canCaptureFillerDuringPreferredPass({
            productIds: ['A'],
            attributes: {
                custom: [{ id: 'brand', count: 1 }]
            }
        }),
        false
    );
    assert.equal(canCaptureFillerDuringPreferredPass({ total: 1, attributes: { custom: [] } }), false);
});
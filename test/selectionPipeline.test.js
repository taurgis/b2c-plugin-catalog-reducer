const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildFilterPlan,
    warnOnDeprecatedSinglePassConfig
} = require('../lib/selectionPipeline');

const getFilterNames = selectorConfig => buildFilterPlan(selectorConfig).map(Filter => Filter.name);

test('buildFilterPlan preserves preferred/master selection order without standalone filler', () => {
    const filterNames = getFilterNames({
        total: 5,
        master: 1,
        productIds: ['MASTER-1'],
        attributes: {
            custom: []
        }
    });

    assert.deepEqual(filterNames, [
        'PreferredMasterProductsFilter',
        'MasterFilter',
        'PreferredProductsFilter'
    ]);
});

test('buildFilterPlan includes attribute and filler filters when custom attributes are configured', () => {
    const filterNames = getFilterNames({
        total: 2,
        master: 0,
        productIds: [],
        attributes: {
            custom: [{ id: 'brand', count: 1 }]
        }
    });

    assert.deepEqual(filterNames, [
        'AttributeFilter',
        'FillerProductsFilter'
    ]);
});

test('buildFilterPlan returns no filters when there are no selection targets', () => {
    assert.deepEqual(getFilterNames({
        total: 0,
        master: 0,
        productIds: [],
        attributes: {
            custom: []
        }
    }), []);
});

test('warnOnDeprecatedSinglePassConfig only emits a warning when singlePass is present', () => {
    const warnings = [];
    const originalEmitWarning = process.emitWarning;

    process.emitWarning = (...args) => {
        warnings.push(args);
    };

    try {
        warnOnDeprecatedSinglePassConfig({ total: 1 });
        warnOnDeprecatedSinglePassConfig({ total: 1, singlePass: true });
    } finally {
        process.emitWarning = originalEmitWarning;
    }

    assert.equal(warnings.length, 1);
    assert.match(String(warnings[0][0]), /singlePass/i);
});
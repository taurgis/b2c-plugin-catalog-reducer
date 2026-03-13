const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
    buildFilterPlan,
    selectProducts,
    warnOnDeprecatedSinglePassConfig
} = require('../lib/selectionPipeline');

const getFilterNames = selectorConfig => buildFilterPlan(selectorConfig).map(Filter => Filter.name);

const createProgressStub = () => ({
    start: () => {},
    stop: () => {},
    update: () => {},
    setTotal: () => {}
});

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

test('selectProducts captures filler products during the preferred pass when standalone filler is omitted', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-selection-pipeline-'));
    const inputFilename = path.join(tempDir, 'preferred-with-filler.xml');
    const selectorConfig = {
        total: 2,
        master: 0,
        productIds: ['PREFERRED-1'],
        attributes: {
            custom: []
        }
    };
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="pipeline-preferred">
    <product product-id="PREFERRED-1">
        <online-flag>true</online-flag>
    </product>
    <product product-id="FILL-1">
        <online-flag>true</online-flag>
        <images>
            <image-group view-type="large">
                <image path="images/fill.jpg"/>
            </image-group>
        </images>
    </product>
</catalog>
`;

    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    await fs.writeFile(inputFilename, xml, 'utf8');

    const selection = await selectProducts(inputFilename, selectorConfig, createProgressStub());

    assert.deepEqual(selection.map(product => product.$attrs['product-id']), ['PREFERRED-1', 'FILL-1']);
    assert.deepEqual(getFilterNames(selectorConfig), [
        'PreferredMasterProductsFilter',
        'PreferredProductsFilter'
    ]);
});
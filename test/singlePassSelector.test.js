const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const { selectProductsSinglePass } = require('../lib/singlePassSelector');

const buildConfig = overrides => ({
    total: 0,
    master: 0,
    productIds: [],
    attributes: {
        custom: []
    },
    ...overrides
});

const getProductIds = selection => selection.map(product => product.$attrs['product-id']);

const buildCatalogXml = () => {
    return `<?xml version="1.0" encoding="UTF-8"?>\n`
        + '<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="single-pass-test">\n'
        + '  <product product-id="MASTER-A">\n'
        + '    <online-flag>false</online-flag>\n'
        + '    <online-flag site-id="MX">true</online-flag>\n'
        + '    <variations>\n'
        + '      <attributes>\n'
        + '        <variation-attribute attribute-id="size" variation-attribute-id="size"/>\n'
        + '      </attributes>\n'
        + '      <variants>\n'
        + '        <variant product-id="VAR-A1"/>\n'
        + '        <variant product-id="VAR-A2"/>\n'
        + '      </variants>\n'
        + '      <variation-groups>\n'
        + '        <variation-group product-id="VG-A"/>\n'
        + '      </variation-groups>\n'
        + '    </variations>\n'
        + '  </product>\n'
        + '  <product product-id="VAR-A1">\n'
        + '    <online-flag>true</online-flag>\n'
        + '    <images><image-group><image path="/var-a1.jpg"/></image-group></images>\n'
        + '  </product>\n'
        + '  <product product-id="VAR-A2">\n'
        + '    <online-flag>true</online-flag>\n'
        + '  </product>\n'
        + '  <product product-id="VG-A">\n'
        + '    <online-flag>true</online-flag>\n'
        + '    <images><image-group><image path="/vg-a.jpg"/></image-group></images>\n'
        + '  </product>\n'
        + '  <product product-id="FILL-1">\n'
        + '    <online-flag>true</online-flag>\n'
        + '    <images><image-group><image path="/fill-1.jpg"/></image-group></images>\n'
        + '  </product>\n'
        + '  <product product-id="OFFLINE-1">\n'
        + '    <online-flag>false</online-flag>\n'
        + '    <images><image-group><image path="/offline.jpg"/></image-group></images>\n'
        + '  </product>\n'
        + '  <product product-id="MASTER-B">\n'
        + '    <online-flag>true</online-flag>\n'
        + '    <variations>\n'
        + '      <attributes>\n'
        + '        <variation-attribute attribute-id="color" variation-attribute-id="color"/>\n'
        + '      </attributes>\n'
        + '      <variants>\n'
        + '        <variant product-id="VAR-B1"/>\n'
        + '      </variants>\n'
        + '    </variations>\n'
        + '  </product>\n'
        + '  <product product-id="VAR-B1">\n'
        + '    <online-flag>true</online-flag>\n'
        + '    <images><image-group><image path="/var-b1.jpg"/></image-group></images>\n'
        + '  </product>\n'
        + '</catalog>\n';
};

const runSinglePass = async (xml, selectorConfig, t) => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-single-pass-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'input.xml');
    await fs.writeFile(inputFilename, xml, 'utf8');

    return selectProductsSinglePass(inputFilename, selectorConfig);
};

test('single-pass selects preferred master and linked products', async t => {
    const result = await runSinglePass(buildCatalogXml(), buildConfig({
        total: 1,
        productIds: ['MASTER-A']
    }), t);

    const productIds = getProductIds(result.selection);

    assert.deepEqual(productIds, ['MASTER-A', 'VAR-A1', 'VAR-A2', 'VG-A']);
    assert.equal(result.unresolvedPreferredProductIds.size, 0);
});

test('single-pass captures filler candidates when preferred set is used', async t => {
    const result = await runSinglePass(buildCatalogXml(), buildConfig({
        total: 2,
        productIds: ['VAR-A2']
    }), t);

    const productIds = getProductIds(result.selection);

    assert.deepEqual(productIds, ['VAR-A2', 'FILL-1']);
});

test('single-pass filler-only mode excludes products linked to encountered masters', async t => {
    const result = await runSinglePass(buildCatalogXml(), buildConfig({
        total: 2
    }), t);

    const productIds = getProductIds(result.selection);

    assert.deepEqual(productIds, ['FILL-1']);
});

test('single-pass keeps unresolved preferred product ids in result state', async t => {
    const result = await runSinglePass(buildCatalogXml(), buildConfig({
        total: 1,
        productIds: ['MISSING-PRODUCT']
    }), t);

    assert.equal(result.unresolvedPreferredProductIds.has('MISSING-PRODUCT'), true);
    assert.equal(result.statistics.total, 1);
});

test('single-pass normalizes selected product image structures', async t => {
    const catalogXml = `<?xml version="1.0" encoding="UTF-8"?>\n`
        + '<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="images">\n'
        + '  <product product-id="IMG-1">\n'
        + '    <online-flag>true</online-flag>\n'
        + '    <images>\n'
        + '      <image-group view-type="large">\n'
        + '        <image path="/img-1.jpg"/>\n'
        + '      </image-group>\n'
        + '    </images>\n'
        + '  </product>\n'
        + '</catalog>\n';

    const result = await runSinglePass(catalogXml, buildConfig({ total: 1 }), t);
    const [product] = result.selection;

    assert.ok(product.images);
    assert.ok(product.images['image-group']);
});

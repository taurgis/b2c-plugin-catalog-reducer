const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const FilterManager = require('../lib/filterManager');
const MasterFilter = require('../lib/filters/masterFilter');
const PreferredMasterProductsFilter = require('../lib/filters/preferredMasterProductsFilter');
const PreferredProductsFilter = require('../lib/filters/preferredProductsFilter');
const AttributeFilter = require('../lib/filters/attributeFilter');
const FillerProductsFilter = require('../lib/filters/fillerProductsFilter');

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

const runPipeline = async (xml, selectorConfig, t) => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-filter-pipeline-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'input.xml');
    await fs.writeFile(inputFilename, xml, 'utf8');

    const filterManager = new FilterManager(inputFilename, selectorConfig);
    filterManager.registerFilter(PreferredMasterProductsFilter);
    filterManager.registerFilter(MasterFilter);
    filterManager.registerFilter(PreferredProductsFilter);
    filterManager.registerFilter(AttributeFilter);
    filterManager.registerFilter(FillerProductsFilter);

    await filterManager.executeFilters();

    return filterManager.getSelection();
};

const createProgressStub = () => ({
    start: () => {},
    stop: () => {},
    update: () => {},
    setTotal: () => {}
});

const createFilterStatistics = () => ({
    total: 0,
    master: 0,
    variants: 0,
    variationGroups: 0,
    attributes: {
        custom: {}
    },
    productIds: new Set()
});

const createPreferredProductsFilter = ({ preferredProductIds = [], enableCapturedFiller = true, totalTarget = 3 } = {}) => {
    const statistics = createFilterStatistics();
    const runtimeState = {
        totalTarget,
        preferredProductIds: new Set(preferredProductIds),
        enableCapturedFiller,
        fillerCandidates: [],
        fillerExcludedProductIds: new Set()
    };
    const filter = new PreferredProductsFilter(
        'unused.xml',
        {},
        statistics,
        createProgressStub(),
        runtimeState
    );

    return {
        filter,
        runtimeState,
        statistics
    };
};

const buildMasterExpansionXml = () => {
    return `<?xml version="1.0" encoding="UTF-8"?>\n`
        + '<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="pipeline-master">\n'
        + '  <product product-id="MASTER-1">\n'
        + '    <online-flag>true</online-flag>\n'
        + '    <variations>\n'
        + '      <attributes>\n'
        + '        <variation-attribute attribute-id="size" variation-attribute-id="size"/>\n'
        + '      </attributes>\n'
        + '      <variants>\n'
        + '        <variant product-id="VAR-1"/>\n'
        + '        <variant product-id="VAR-2"/>\n'
        + '      </variants>\n'
        + '    </variations>\n'
        + '  </product>\n'
        + '  <product product-id="VAR-1">\n'
        + '    <online-flag>true</online-flag>\n'
        + '  </product>\n'
        + '  <product product-id="VAR-2">\n'
        + '    <online-flag>true</online-flag>\n'
        + '  </product>\n'
        + '  <product product-id="FILL-1">\n'
        + '    <online-flag>true</online-flag>\n'
        + '    <images>\n'
        + '      <image-group view-type="large">\n'
        + '        <image path="images/fill.jpg"/>\n'
        + '      </image-group>\n'
        + '    </images>\n'
        + '  </product>\n'
        + '</catalog>\n';
};

const buildAttributeThenFillerXml = () => {
    return `<?xml version="1.0" encoding="UTF-8"?>\n`
        + '<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="pipeline-attribute">\n'
        + '  <product product-id="ATTR-1">\n'
        + '    <online-flag>true</online-flag>\n'
        + '    <custom-attributes>\n'
        + '      <custom-attribute attribute-id="brand">Acme</custom-attribute>\n'
        + '    </custom-attributes>\n'
        + '  </product>\n'
        + '  <product product-id="FILL-1">\n'
        + '    <online-flag>true</online-flag>\n'
        + '    <images>\n'
        + '      <image-group view-type="large">\n'
        + '        <image path="images/fill.jpg"/>\n'
        + '      </image-group>\n'
        + '    </images>\n'
        + '  </product>\n'
        + '</catalog>\n';
};


test('preferred master expands target and deduplicates linked variants', async t => {
    const selection = await runPipeline(buildMasterExpansionXml(), buildConfig({
        total: 1,
        master: 1,
        productIds: ['MASTER-1']
    }), t);

    const productIds = getProductIds(selection);

    assert.deepEqual(productIds, ['MASTER-1', 'VAR-1', 'VAR-2']);
    assert.equal(new Set(productIds).size, productIds.length);
    assert.equal(productIds.includes('FILL-1'), false);
});

test('attribute filter selection is followed by filler products when capacity remains', async t => {
    const selection = await runPipeline(buildAttributeThenFillerXml(), buildConfig({
        total: 2,
        attributes: {
            custom: [
                {
                    id: 'brand',
                    value: 'Acme',
                    count: 1
                }
            ]
        }
    }), t);

    const productIds = getProductIds(selection);

    assert.deepEqual(productIds, ['ATTR-1', 'FILL-1']);
    assert.equal(new Set(productIds).size, productIds.length);
});

test('unresolved preferred product ids do not block attribute and filler selection', async t => {
    const selection = await runPipeline(buildAttributeThenFillerXml(), buildConfig({
        total: 2,
        productIds: ['DOES-NOT-EXIST'],
        attributes: {
            custom: [
                {
                    id: 'brand',
                    value: 'Acme',
                    count: 1
                }
            ]
        }
    }), t);

    const productIds = getProductIds(selection);

    assert.deepEqual(productIds, ['ATTR-1', 'FILL-1']);
    assert.equal(new Set(productIds).size, productIds.length);
});

test('filler filter marks master-linked variants and variation groups as selected', () => {
    const statistics = {
        total: 0,
        master: 0,
        variants: 0,
        variationGroups: 0,
        attributes: {
            custom: {}
        },
        productIds: new Set()
    };
    const runtimeState = {
        totalTarget: 5,
        preferredProductIds: new Set()
    };
    const progress = {
        start: () => {},
        stop: () => {},
        update: () => {},
        setTotal: () => {}
    };
    const filter = new FillerProductsFilter('unused.xml', {}, statistics, progress, runtimeState);

    const result = filter.process({
        variations: {
            variants: {
                variant: {
                    $attrs: {
                        'product-id': 'VAR-1'
                    }
                }
            },
            'variation-groups': {
                'variation-group': {
                    $attrs: {
                        'product-id': 'VG-1'
                    }
                }
            }
        }
    });

    assert.deepEqual(result, { finished: false });
    assert.equal(statistics.productIds.has('VAR-1'), true);
    assert.equal(statistics.productIds.has('VG-1'), true);
});

test('master filter shouldSkip reflects master target progress', () => {
    const statistics = createFilterStatistics();
    const runtimeState = {
        totalTarget: 5,
        preferredProductIds: new Set()
    };
    const filter = new MasterFilter('unused.xml', { master: 1 }, statistics, createProgressStub(), runtimeState);

    assert.equal(filter.shouldSkip(), false);
    filter.updateStatistics('MASTER-1');
    assert.equal(statistics.master, 1);
    assert.equal(filter.shouldSkip(), true);
    filter.updateStatistics(null);
    assert.equal(statistics.total, 1);
});

test('preferred products filter selects preferred ids and skip behavior reflects capture mode', () => {
    const { filter, runtimeState } = createPreferredProductsFilter({
        preferredProductIds: ['PREF-1'],
        enableCapturedFiller: true
    });

    const selectedResult = filter.process({
        $attrs: {
            'product-id': 'PREF-1'
        }
    });

    assert.deepEqual(selectedResult, {
        finished: false,
        selection: {
            $attrs: {
                'product-id': 'PREF-1'
            }
        }
    });
    assert.equal(runtimeState.preferredProductIds.size, 0);

    assert.equal(filter.shouldSkip(), false);

    runtimeState.enableCapturedFiller = false;
    assert.equal(filter.shouldSkip(), true);
});

test('preferred products filter captures filler candidates and excludes master-linked products', () => {
    const { filter, runtimeState } = createPreferredProductsFilter({
        preferredProductIds: [],
        enableCapturedFiller: true
    });

    filter.process({
        $attrs: {
            'product-id': 'MASTER-1'
        },
        variations: {
            variants: {
                variant: {
                    $attrs: {
                        'product-id': 'VAR-1'
                    }
                }
            },
            'variation-groups': {
                'variation-group': {
                    $attrs: {
                        'product-id': 'VG-1'
                    }
                }
            }
        }
    });

    assert.equal(runtimeState.fillerExcludedProductIds.has('VAR-1'), true);
    assert.equal(runtimeState.fillerExcludedProductIds.has('VG-1'), true);

    filter.process({
        $attrs: {
            'product-id': 'VAR-1'
        },
        images: {
            'image-group': {
                image: {
                    $attrs: {
                        path: '/var-1.jpg'
                    }
                }
            }
        }
    });

    assert.equal(runtimeState.fillerCandidates.length, 0);

    filter.process({
        $attrs: {
            'product-id': 'FILL-1'
        },
        images: {
            'image-group': {
                image: {
                    $attrs: {
                        path: '/fill-1.jpg'
                    }
                }
            }
        }
    });

    assert.equal(runtimeState.fillerCandidates.length, 1);
    assert.equal(runtimeState.fillerCandidates[0].$attrs['product-id'], 'FILL-1');
});

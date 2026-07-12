const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const Filter = require('../lib/filters/filter');

const createFilterContext = () => {
    return {
        selectorConfig: {
            total: 1
        },
        statistics: {
            total: 0,
            variants: 0,
            variationGroups: 0,
            productIds: new Set()
        },
        progress: {
            setTotal() {},
            update() {}
        },
        runtimeState: {
            totalTarget: 1,
            preferredProductIds: new Set()
        }
    };
};

const writeTempCatalog = async (t, xmlBody) => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-filter-base-'));

    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'input.xml');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
        + `<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="base-filter">${xmlBody}</catalog>`;

    await fs.writeFile(inputFilename, xml, 'utf8');

    return inputFilename;
};

test('base Filter default process returns FINISHED and logs warning', async t => {
    const inputFilename = await writeTempCatalog(
        t,
        '<product product-id="BASE-1"><online-flag>true</online-flag></product>'
    );
    const { selectorConfig, statistics, progress, runtimeState } = createFilterContext();
    const filter = new Filter(inputFilename, selectorConfig, statistics, progress, runtimeState);
    const originalWarn = console.warn;
    const warnings = [];

    console.warn = message => {
        warnings.push(String(message));
    };

    try {
        const results = await filter.execute();

        assert.deepEqual(results, []);
        assert.equal(warnings.length, 1);
        assert.match(warnings[0], /Unable to filter product/);
    } finally {
        console.warn = originalWarn;
    }
});

test('base Filter settles on XML end when no products are emitted', async t => {
    const inputFilename = await writeTempCatalog(t, '');

    class PassiveFilter extends Filter {
        process() {
            return Filter.NOT_FINISHED;
        }
    }

    const { selectorConfig, statistics, progress, runtimeState } = createFilterContext();
    const filter = new PassiveFilter(inputFilename, selectorConfig, statistics, progress, runtimeState);
    const results = await filter.execute();

    assert.deepEqual(results, []);
    assert.equal(statistics.total, 0);
});

test('base Filter keeps any true online-flag when onlineSiteIds is not configured', async t => {
    const inputFilename = await writeTempCatalog(
        t,
        '<product product-id="GLOBAL-ON"><online-flag>true</online-flag></product>'
        + '<product product-id="SITE-B-ON">'
        + '<online-flag site-id="SiteA">false</online-flag>'
        + '<online-flag site-id="SiteB">true</online-flag>'
        + '</product>'
        + '<product product-id="ALL-SITES-OFF">'
        + '<online-flag site-id="SiteA">false</online-flag>'
        + '<online-flag site-id="SiteB">false</online-flag>'
        + '</product>'
    );

    class CollectAllFilter extends Filter {
        process(product) {
            return Filter.NOT_FINISHED_WITH_PRODUCT(product);
        }
    }

    const { selectorConfig, statistics, progress, runtimeState } = createFilterContext();
    const filter = new CollectAllFilter(inputFilename, selectorConfig, statistics, progress, runtimeState);
    const results = await filter.execute();
    const keptIds = results.map(product => product.$attrs['product-id']);

    assert.deepEqual(keptIds, ['GLOBAL-ON', 'SITE-B-ON']);
});

test('base Filter restricts online status to the configured site IDs', async t => {
    const inputFilename = await writeTempCatalog(
        t,
        '<product product-id="GLOBAL-ON"><online-flag>true</online-flag></product>'
        + '<product product-id="SITE-A-ON">'
        + '<online-flag site-id="SiteA">true</online-flag>'
        + '<online-flag site-id="SiteB">false</online-flag>'
        + '</product>'
        + '<product product-id="SITE-B-ON">'
        + '<online-flag site-id="SiteA">false</online-flag>'
        + '<online-flag site-id="SiteB">true</online-flag>'
        + '</product>'
        + '<product product-id="ALL-SITES-OFF">'
        + '<online-flag site-id="SiteA">false</online-flag>'
        + '<online-flag site-id="SiteB">false</online-flag>'
        + '</product>'
    );

    class CollectAllFilter extends Filter {
        process(product) {
            return Filter.NOT_FINISHED_WITH_PRODUCT(product);
        }
    }

    const { selectorConfig, statistics, progress, runtimeState } = createFilterContext();
    selectorConfig.onlineSiteIds = ['SiteA'];

    const filter = new CollectAllFilter(inputFilename, selectorConfig, statistics, progress, runtimeState);
    const results = await filter.execute();
    const keptIds = results.map(product => product.$attrs['product-id']);

    assert.deepEqual(keptIds, ['GLOBAL-ON', 'SITE-A-ON']);
});

test('base Filter falls back to the global online-flag for a configured site with no explicit override', async t => {
    const inputFilename = await writeTempCatalog(
        t,
        // SiteC has no explicit override; it should inherit the true global default
        // even though this product also overrides an unrelated site (SiteA) to false.
        '<product product-id="INHERITS-GLOBAL-FOR-SITE-C">'
        + '<online-flag>true</online-flag>'
        + '<online-flag site-id="SiteA">false</online-flag>'
        + '</product>'
    );

    class CollectAllFilter extends Filter {
        process(product) {
            return Filter.NOT_FINISHED_WITH_PRODUCT(product);
        }
    }

    const { selectorConfig, statistics, progress, runtimeState } = createFilterContext();
    selectorConfig.onlineSiteIds = ['SiteC'];

    const filter = new CollectAllFilter(inputFilename, selectorConfig, statistics, progress, runtimeState);
    const results = await filter.execute();
    const keptIds = results.map(product => product.$attrs['product-id']);

    assert.deepEqual(keptIds, ['INHERITS-GLOBAL-FOR-SITE-C']);
});
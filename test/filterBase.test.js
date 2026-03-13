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
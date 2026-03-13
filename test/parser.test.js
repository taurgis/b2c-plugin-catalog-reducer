const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const parser = require('../lib/parser');

const baseConfig = {
    total: 0,
    master: 0,
    productIds: [],
    attributes: {
        custom: []
    },
    beautify: false,
    pricebookRandomSeed: null,
    pricebookSourceFiles: []
};

const buildCatalogXml = ({ includeCatalogId = true, leadingCommentLines = 0 } = {}) => {
    const catalogIdAttribute = includeCatalogId ? ' catalog-id="test-catalog"' : '';
    const commentPreamble = Array.from({ length: leadingCommentLines })
        .map((_, index) => `<!-- preamble line ${index + 1} -->`)
        .join('\n');
    const preamble = commentPreamble ? `${commentPreamble}\n` : '';

    return `<?xml version="1.0" encoding="UTF-8"?>\n`
        + preamble
        + `<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31"${catalogIdAttribute}>\n`
        + '  <product product-id="TEST-PRODUCT">\n'
        + '    <online-flag>true</online-flag>\n'
        + '    <images>\n'
        + '      <image-group view-type="large">\n'
        + '        <image path="images/test.jpg"/>\n'
        + '      </image-group>\n'
        + '    </images>\n'
        + '  </product>\n'
        + '</catalog>\n';
};

const buildMultilineCatalogTagXml = () => {
    return `<?xml version="1.0" encoding="UTF-8"?>\n`
        + '<catalog\n'
        + '  xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31"\n'
        + '  catalog-id="test-catalog"\n'
        + '>\n'
        + '  <product product-id="TEST-PRODUCT">\n'
        + '    <online-flag>true</online-flag>\n'
        + '    <images>\n'
        + '      <image-group view-type="large">\n'
        + '        <image path="images/test.jpg"/>\n'
        + '      </image-group>\n'
        + '    </images>\n'
        + '  </product>\n'
        + '</catalog>\n';
};

const buildCatalogXmlWithCatalogTextInComment = () => {
    return `<?xml version="1.0" encoding="UTF-8"?>\n`
        + '<!-- this comment contains <catalog and should be ignored -->\n'
        + '<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="test-catalog">\n'
        + '  <product product-id="TEST-PRODUCT">\n'
        + '    <online-flag>true</online-flag>\n'
        + '    <images>\n'
        + '      <image-group view-type="large">\n'
        + '        <image path="images/test.jpg"/>\n'
        + '      </image-group>\n'
        + '    </images>\n'
        + '  </product>\n'
        + '</catalog>\n';
};

const buildCatalogXmlWithSingleQuotes = () => {
    return `<?xml version="1.0" encoding="UTF-8"?>\n`
        + '<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id=\'test-catalog\'>\n'
        + '  <product product-id="TEST-PRODUCT">\n'
        + '    <online-flag>true</online-flag>\n'
        + '    <images>\n'
        + '      <image-group view-type="large">\n'
        + '        <image path="images/test.jpg"/>\n'
        + '      </image-group>\n'
        + '    </images>\n'
        + '  </product>\n'
        + '</catalog>\n';
};

const buildSourcePricebookXml = ({ pricebookId, entries }) => {
    const priceTableXml = entries
        .map(({ productId, amount }) => {
            return `<price-table product-id="${productId}"><amount quantity="1">${amount}</amount></price-table>`;
        })
        .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>\n`
        + '<pricebooks xmlns="http://www.demandware.com/xml/impex/pricebook/2006-10-31">\n'
        + '  <pricebook>\n'
        + `    <header pricebook-id="${pricebookId}">\n`
        + '      <currency>EUR</currency>\n'
        + `      <display-name>${pricebookId}</display-name>\n`
        + '      <online-flag>true</online-flag>\n'
        + '    </header>\n'
        + `    <price-tables>${priceTableXml}</price-tables>\n`
        + '  </pricebook>\n'
        + '</pricebooks>\n';
};

const fileExists = async filePath => {
    try {
        await fs.access(filePath);
        return true;
    } catch (error) {
        return false;
    }
};

test('parse rejects when catalog-id is missing', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-parser-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'input.xml');
    const outputFilename = path.join(tempDir, 'output.xml');
    await fs.writeFile(inputFilename, buildCatalogXml({ includeCatalogId: false }), 'utf8');

    await assert.rejects(
        () => parser.parse(inputFilename, outputFilename, { ...baseConfig }),
        /catalog-id/i
    );
});

test('parse rejects when writing output fails', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-parser-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'input.xml');
    const outputFilename = path.join(tempDir, 'missing-directory', 'output.xml');
    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');

    await assert.rejects(
        () => parser.parse(inputFilename, outputFilename, { ...baseConfig }),
        /ENOENT|no such file/i
    );
});

test('parse writes catalog, inventory and pricebook files', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-parser-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'input.xml');
    const outputFilename = path.join(tempDir, 'output.xml');

    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');
    await parser.parse(inputFilename, outputFilename, { ...baseConfig, total: 1 });

    assert.equal(await fileExists(outputFilename), true);
    assert.equal(await fileExists(path.join(tempDir, 'output-inventory.xml')), true);
    assert.equal(await fileExists(path.join(tempDir, 'output-pricebook.xml')), true);

    const catalogOutput = await fs.readFile(outputFilename, 'utf8');
    const inventoryOutput = await fs.readFile(path.join(tempDir, 'output-inventory.xml'), 'utf8');
    const pricebookOutput = await fs.readFile(path.join(tempDir, 'output-pricebook.xml'), 'utf8');

    assert.match(catalogOutput, /catalog-id="test-catalog"/i);
    assert.match(inventoryOutput, /<inventory\b/i);
    assert.match(inventoryOutput, /catalog-reducer-inventory/i);
    assert.match(pricebookOutput, /<pricebooks\b/i);
    assert.match(pricebookOutput, /catalog-reducer-pricebook/i);
    assert.match(pricebookOutput, /<amount quantity="1">\d+\.\d{2}<\/amount>/i);
});

test('parse still resolves catalog-id when file has a long preamble', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-parser-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'long-preamble.xml');
    const outputFilename = path.join(tempDir, 'long-preamble-output.xml');
    await fs.writeFile(inputFilename, buildCatalogXml({ leadingCommentLines: 40 }), 'utf8');

    await parser.parse(inputFilename, outputFilename, { ...baseConfig });

    assert.equal(await fileExists(outputFilename), true);
    assert.equal(await fileExists(path.join(tempDir, 'long-preamble-output-inventory.xml')), true);
    assert.equal(await fileExists(path.join(tempDir, 'long-preamble-output-pricebook.xml')), true);
});

test('parse resolves catalog-id when catalog opening tag spans multiple lines', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-parser-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'multiline-catalog-tag.xml');
    const outputFilename = path.join(tempDir, 'multiline-catalog-tag-output.xml');
    await fs.writeFile(inputFilename, buildMultilineCatalogTagXml(), 'utf8');

    await parser.parse(inputFilename, outputFilename, { ...baseConfig, total: 1 });

    const catalogOutput = await fs.readFile(outputFilename, 'utf8');
    assert.match(catalogOutput, /catalog-id="test-catalog"/i);
});

test('parse ignores catalog-like text inside XML comments', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-parser-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'comment-with-catalog.xml');
    const outputFilename = path.join(tempDir, 'comment-with-catalog-output.xml');
    await fs.writeFile(inputFilename, buildCatalogXmlWithCatalogTextInComment(), 'utf8');

    await parser.parse(inputFilename, outputFilename, { ...baseConfig, total: 1 });

    const catalogOutput = await fs.readFile(outputFilename, 'utf8');
    assert.match(catalogOutput, /catalog-id="test-catalog"/i);
});

test('parse resolves catalog-id when opening tag uses single quotes', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-parser-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'single-quote-catalog-tag.xml');
    const outputFilename = path.join(tempDir, 'single-quote-catalog-tag-output.xml');
    await fs.writeFile(inputFilename, buildCatalogXmlWithSingleQuotes(), 'utf8');

    await parser.parse(inputFilename, outputFilename, { ...baseConfig, total: 1 });

    const catalogOutput = await fs.readFile(outputFilename, 'utf8');
    assert.match(catalogOutput, /catalog-id="test-catalog"/i);
});

test('seeded pricebook generation is deterministic', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-parser-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'seeded-input.xml');
    const outputA = path.join(tempDir, 'seeded-output-a.xml');
    const outputB = path.join(tempDir, 'seeded-output-b.xml');
    const outputC = path.join(tempDir, 'seeded-output-c.xml');
    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');

    await parser.parse(inputFilename, outputA, { ...baseConfig, total: 1, pricebookRandomSeed: 1234 });
    await parser.parse(inputFilename, outputB, { ...baseConfig, total: 1, pricebookRandomSeed: 1234 });
    await parser.parse(inputFilename, outputC, { ...baseConfig, total: 1, pricebookRandomSeed: 9999 });

    const pricebookOutputA = await fs.readFile(path.join(tempDir, 'seeded-output-a-pricebook.xml'), 'utf8');
    const pricebookOutputB = await fs.readFile(path.join(tempDir, 'seeded-output-b-pricebook.xml'), 'utf8');
    const pricebookOutputC = await fs.readFile(path.join(tempDir, 'seeded-output-c-pricebook.xml'), 'utf8');

    assert.equal(pricebookOutputA, pricebookOutputB);
    assert.notEqual(pricebookOutputA, pricebookOutputC);
});

test('parse filters configured source pricebooks by selected products', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-parser-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'source-pricebook-input.xml');
    const outputFilename = path.join(tempDir, 'source-pricebook-output.xml');
    const listPricebookFilename = path.join(tempDir, 'list-pricebook.xml');
    const salePricebookFilename = path.join(tempDir, 'sale-pricebook.xml');

    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');
    await fs.writeFile(
        listPricebookFilename,
        buildSourcePricebookXml({
            pricebookId: 'list-prices',
            entries: [
                { productId: 'TEST-PRODUCT', amount: '79.99' },
                { productId: 'OTHER-PRODUCT', amount: '999.99' }
            ]
        }),
        'utf8'
    );
    await fs.writeFile(
        salePricebookFilename,
        buildSourcePricebookXml({
            pricebookId: 'sale-prices',
            entries: [
                { productId: 'TEST-PRODUCT', amount: '49.99' },
                { productId: 'OTHER-PRODUCT', amount: '399.99' }
            ]
        }),
        'utf8'
    );

    await parser.parse(inputFilename, outputFilename, {
        ...baseConfig,
        total: 1,
        pricebookSourceFiles: [listPricebookFilename, salePricebookFilename]
    });

    const listPricebookOutputFilename = path.join(tempDir, 'source-pricebook-output-list-pricebook.xml');
    const salePricebookOutputFilename = path.join(tempDir, 'source-pricebook-output-sale-pricebook.xml');
    const listPricebookOutput = await fs.readFile(listPricebookOutputFilename, 'utf8');
    const salePricebookOutput = await fs.readFile(salePricebookOutputFilename, 'utf8');

    assert.equal(await fileExists(path.join(tempDir, 'source-pricebook-output-pricebook.xml')), false);
    assert.match(listPricebookOutput, /pricebook-id="list-prices"/i);
    assert.match(listPricebookOutput, /product-id="TEST-PRODUCT"/i);
    assert.match(listPricebookOutput, /<amount quantity="1">79\.99<\/amount>/i);
    assert.doesNotMatch(listPricebookOutput, /product-id="OTHER-PRODUCT"/i);
    assert.match(salePricebookOutput, /pricebook-id="sale-prices"/i);
    assert.match(salePricebookOutput, /product-id="TEST-PRODUCT"/i);
    assert.match(salePricebookOutput, /<amount quantity="1">49\.99<\/amount>/i);
    assert.doesNotMatch(salePricebookOutput, /product-id="OTHER-PRODUCT"/i);
    assert.doesNotMatch(listPricebookOutput, /catalog-reducer-pricebook/i);
    assert.doesNotMatch(salePricebookOutput, /catalog-reducer-pricebook/i);
});

test('parse rejects when configured source pricebook file is missing', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-parser-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'missing-source-pricebook-input.xml');
    const outputFilename = path.join(tempDir, 'missing-source-pricebook-output.xml');
    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');

    await assert.rejects(
        () => parser.parse(inputFilename, outputFilename, {
            ...baseConfig,
            total: 1,
            pricebookSourceFiles: [path.join(tempDir, 'missing-pricebook.xml')]
        }),
        /pricebook source file/i
    );
});

test('parse removes stale combined pricebook output when source pricebook files are configured', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-parser-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'stale-source-pricebook-input.xml');
    const outputFilename = path.join(tempDir, 'stale-source-pricebook-output.xml');
    const listPricebookFilename = path.join(tempDir, 'list-pricebook.xml');
    const salePricebookFilename = path.join(tempDir, 'sale-pricebook.xml');
    const staleCombinedPricebookFilename = path.join(tempDir, 'stale-source-pricebook-output-pricebook.xml');

    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');
    await fs.writeFile(
        listPricebookFilename,
        buildSourcePricebookXml({
            pricebookId: 'list-prices',
            entries: [{ productId: 'TEST-PRODUCT', amount: '79.99' }]
        }),
        'utf8'
    );
    await fs.writeFile(
        salePricebookFilename,
        buildSourcePricebookXml({
            pricebookId: 'sale-prices',
            entries: [{ productId: 'TEST-PRODUCT', amount: '49.99' }]
        }),
        'utf8'
    );
    await fs.writeFile(staleCombinedPricebookFilename, '<stale/>', 'utf8');

    await parser.parse(inputFilename, outputFilename, {
        ...baseConfig,
        total: 1,
        pricebookSourceFiles: [listPricebookFilename, salePricebookFilename]
    });

    assert.equal(await fileExists(staleCombinedPricebookFilename), false);
});

test('parse ignores deprecated singlePass config and writes expected outputs', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-parser-'));
    const warnings = [];
    const originalEmitWarning = process.emitWarning;

    process.emitWarning = (...args) => {
        warnings.push(args);
    };

    t.after(async () => {
        process.emitWarning = originalEmitWarning;
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'single-pass-input.xml');
    const outputFilename = path.join(tempDir, 'single-pass-output.xml');
    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');

    await parser.parse(inputFilename, outputFilename, {
        ...baseConfig,
        total: 1,
        singlePass: true
    });

    assert.equal(await fileExists(outputFilename), true);
    assert.equal(await fileExists(path.join(tempDir, 'single-pass-output-inventory.xml')), true);
    assert.equal(await fileExists(path.join(tempDir, 'single-pass-output-pricebook.xml')), true);

    const catalogOutput = await fs.readFile(outputFilename, 'utf8');

    assert.equal(warnings.length, 1);
    assert.match(String(warnings[0][0]), /singlePass/i);
    assert.match(catalogOutput, /catalog-id="test-catalog"/i);
    assert.match(catalogOutput, /<product\s+product-id="TEST-PRODUCT"/i);
});

test('parse skips pretty formatting when beautify is false', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-parser-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'compact-input.xml');
    const outputFilename = path.join(tempDir, 'compact-output.xml');
    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');

    await parser.parse(inputFilename, outputFilename, {
        ...baseConfig,
        total: 1,
        beautify: false
    });

    const catalogOutput = await fs.readFile(outputFilename, 'utf8');

    assert.match(catalogOutput, /<catalog\b[^>]*><product\b/i);
});

test('parse keeps formatted output by default when beautify is not set', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-parser-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const inputFilename = path.join(tempDir, 'formatted-input.xml');
    const outputFilename = path.join(tempDir, 'formatted-output.xml');
    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');

    const configWithoutBeautify = {
        total: 1,
        master: 0,
        productIds: [],
        attributes: {
            custom: []
        },
        pricebookRandomSeed: null
    };

    await parser.parse(inputFilename, outputFilename, configWithoutBeautify);

    const catalogOutput = await fs.readFile(outputFilename, 'utf8');

    assert.match(catalogOutput, /<catalog\b[^>]*>\s*\n\s+<product\b/i);
});

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it} from 'vitest';

import {createSilentRuntime} from '../runtimeSupport';
import {SelectorConfig} from '../types';
import {parseCatalog} from './index';

const baseConfig: SelectorConfig = {
  total: 0,
  master: 0,
  productIds: [],
  attributes: {
    custom: []
  },
  beautify: false,
  pricebookRandomSeed: null,
  pricebookSourceFiles: [],
  storefrontSourceFiles: []
};

const buildCatalogXml = ({includeCatalogId = true, leadingCommentLines = 0}: {includeCatalogId?: boolean; leadingCommentLines?: number} = {}): string => {
  const catalogIdAttribute = includeCatalogId ? ' catalog-id="test-catalog"' : '';
  const commentPreamble = Array.from({length: leadingCommentLines})
    .map((_, index) => `<!-- preamble line ${index + 1} -->`)
    .join('\n');
  const preamble = commentPreamble ? `${commentPreamble}\n` : '';

  return '<?xml version="1.0" encoding="UTF-8"?>\n'
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

const buildCatalogXmlWithBundledProducts = (): string => {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="bundle-catalog">\n'
    + '  <product product-id="BUNDLE-PRODUCT">\n'
    + '    <online-flag>true</online-flag>\n'
    + '    <bundled-products>\n'
    + '      <bundled-product product-id="BUNDLE-CHILD-1">\n'
    + '        <quantity>1</quantity>\n'
    + '      </bundled-product>\n'
    + '      <bundled-product product-id="BUNDLE-CHILD-2">\n'
    + '        <quantity>2</quantity>\n'
    + '      </bundled-product>\n'
    + '    </bundled-products>\n'
    + '    <options>\n'
    + '      <shared-option option-id="consoleWarranty"/>\n'
    + '    </options>\n'
    + '  </product>\n'
    + '</catalog>\n';
};

const buildCatalogXmlWithPageAttributes = (): string => {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="page-attributes-catalog">\n'
    + '  <product product-id="PAGE-ATTR-PRODUCT">\n'
    + '    <online-flag>true</online-flag>\n'
    + '    <page-attributes>\n'
    + '      <page-title xml:lang="x-default">Look of the week - LOLALIZA</page-title>\n'
    + '      <page-title xml:lang="fr">Look de la semaine - LOLALIZA</page-title>\n'
    + '    </page-attributes>\n'
    + '  </product>\n'
    + '</catalog>\n';
};

const buildMultilineCatalogTagXml = (): string => {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
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

const buildCatalogXmlWithCatalogTextInComment = (): string => {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
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

const buildCatalogXmlWithSingleQuotes = (): string => {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
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

const buildSourcePricebookXml = ({pricebookId, entries}: {pricebookId: string; entries: Array<{productId: string; amount: string}>}): string => {
  const priceTableXml = entries
    .map(({productId, amount}) => {
      return `<price-table product-id="${productId}"><amount quantity="1">${amount}</amount></price-table>`;
    })
    .join('');

  return '<?xml version="1.0" encoding="UTF-8"?>\n'
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

const buildSourcePricebooksXml = (pricebooks: Array<{pricebookId: string; entries: Array<{productId: string; amount: string}>}>): string => {
  const pricebookXml = pricebooks.map(({pricebookId, entries}) => {
    const priceTableXml = entries
      .map(({productId, amount}) => {
        return `<price-table product-id="${productId}"><amount quantity="1">${amount}</amount></price-table>`;
      })
      .join('');

    return '  <pricebook>\n'
      + `    <header pricebook-id="${pricebookId}">\n`
      + '      <currency>EUR</currency>\n'
      + `      <display-name>${pricebookId}</display-name>\n`
      + '      <online-flag>true</online-flag>\n'
      + '    </header>\n'
      + `    <price-tables>${priceTableXml}</price-tables>\n`
      + '  </pricebook>';
  }).join('\n');

  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<pricebooks xmlns="http://www.demandware.com/xml/impex/pricebook/2006-10-31">\n'
    + `${pricebookXml}\n`
    + '</pricebooks>\n';
};

const buildStorefrontCatalogXml = (): string => {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="storefront-catalog">\n'
    + '  <header>\n'
    + '    <image-settings/>\n'
    + '  </header>\n'
    + '  <category category-id="root"/>\n'
    + '  <category category-id="child">\n'
    + '    <parent>root</parent>\n'
    + '  </category>\n'
    + '  <category-assignment category-id="root" product-id="TEST-PRODUCT">\n'
    + '    <primary-flag>true</primary-flag>\n'
    + '  </category-assignment>\n'
    + '  <category-assignment category-id="child" product-id="OTHER-PRODUCT"/>\n'
    + '</catalog>\n';
};

const buildStorefrontCatalogXmlWithInvalidCharRefs = (): string => {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="storefront-catalog">\n'
    + '  <category category-id="root">\n'
    + '    <custom-attributes>\n'
    + '      <custom-attribute attribute-id="seoText" xml:lang="x-default">&#55358;&#56721; Welcome</custom-attribute>\n'
    + '    </custom-attributes>\n'
    + '  </category>\n'
    + '  <category-assignment category-id="root" product-id="TEST-PRODUCT"/>\n'
    + '</catalog>\n';
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

describe('parseCatalog', () => {
  const tempDirs: string[] = [];

  const mkTempDir = async (): Promise<string> => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-parser-'));
    tempDirs.push(tempDir);
    return tempDir;
  };

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, {recursive: true, force: true})));
  });

  it('rejects when catalog-id is missing', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'input.xml');
    const outputFilename = path.join(tempDir, 'output.xml');
    await fs.writeFile(inputFilename, buildCatalogXml({includeCatalogId: false}), 'utf8');

    await expect(parseCatalog(inputFilename, outputFilename, {...baseConfig})).rejects.toThrow(/catalog-id/i);
  });

  it('rejects when writing output fails', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'input.xml');
    const outputFilename = path.join(tempDir, 'missing-directory', 'output.xml');
    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');

    await expect(parseCatalog(inputFilename, outputFilename, {...baseConfig})).rejects.toThrow(/ENOENT|no such file/i);
  });

  it('writes catalog, inventory and pricebook files', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'input.xml');
    const outputFilename = path.join(tempDir, 'output.xml');

    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');
    await parseCatalog(inputFilename, outputFilename, {...baseConfig, total: 1});

    expect(await fileExists(outputFilename)).toBe(true);
    expect(await fileExists(path.join(tempDir, 'output-inventory.xml'))).toBe(true);
    expect(await fileExists(path.join(tempDir, 'output-pricebook.xml'))).toBe(true);

    const catalogOutput = await fs.readFile(outputFilename, 'utf8');
    const inventoryOutput = await fs.readFile(path.join(tempDir, 'output-inventory.xml'), 'utf8');
    const pricebookOutput = await fs.readFile(path.join(tempDir, 'output-pricebook.xml'), 'utf8');

    expect(catalogOutput).toMatch(/catalog-id="test-catalog"/i);
    expect(inventoryOutput).toMatch(/<inventory\b/i);
    expect(inventoryOutput).toMatch(/catalog-reducer-inventory/i);
    expect(pricebookOutput).toMatch(/<pricebooks\b/i);
    expect(pricebookOutput).toMatch(/catalog-reducer-pricebook/i);
    expect(pricebookOutput).toMatch(/<amount quantity="1">\d+\.\d{2}<\/amount>/i);
  });

  it('in dry-run mode writes no output files', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'input.xml');
    const outputFilename = path.join(tempDir, 'output.xml');

    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');
    await parseCatalog(
      inputFilename,
      outputFilename,
      {...baseConfig, total: 1},
      {...createSilentRuntime(), dryRun: true}
    );

    expect(await fileExists(outputFilename)).toBe(false);
    expect(await fileExists(path.join(tempDir, 'output-inventory.xml'))).toBe(false);
    expect(await fileExists(path.join(tempDir, 'output-pricebook.xml'))).toBe(false);
    expect(await fileExists(path.join(tempDir, '.catalog-reducer-cache'))).toBe(false);
  });

  it('reuses a cached selection on the next run and produces identical output', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'input.xml');
    const firstOutputFilename = path.join(tempDir, 'first-output.xml');
    const secondOutputFilename = path.join(tempDir, 'second-output.xml');
    const config = {...baseConfig, total: 1};

    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');
    await parseCatalog(inputFilename, firstOutputFilename, config, createSilentRuntime());

    const cacheDir = path.join(tempDir, '.catalog-reducer-cache');
    const cacheEntriesAfterFirstRun = await fs.readdir(cacheDir);
    expect(cacheEntriesAfterFirstRun).toHaveLength(1);

    const logMessages: string[] = [];
    const runtimeWithLogger = {
      ...createSilentRuntime(),
      logger: {
        info: (message: unknown) => logMessages.push(String(message)),
        warn: () => {},
        error: () => {}
      }
    };

    await parseCatalog(inputFilename, secondOutputFilename, config, runtimeWithLogger);

    expect(logMessages.some(message => /Using cached product selection/.test(message))).toBe(true);
    expect(await fs.readFile(firstOutputFilename, 'utf8')).toEqual(await fs.readFile(secondOutputFilename, 'utf8'));
  });

  it('with caching disabled does not read or write the cache', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'input.xml');
    const outputFilename = path.join(tempDir, 'output.xml');

    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');
    await parseCatalog(
      inputFilename,
      outputFilename,
      {...baseConfig, total: 1},
      {...createSilentRuntime(), useCache: false}
    );

    expect(await fileExists(outputFilename)).toBe(true);
    expect(await fileExists(path.join(tempDir, '.catalog-reducer-cache'))).toBe(false);
  });

  it('still resolves catalog-id when file has a long preamble', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'long-preamble.xml');
    const outputFilename = path.join(tempDir, 'long-preamble-output.xml');
    await fs.writeFile(inputFilename, buildCatalogXml({leadingCommentLines: 40}), 'utf8');

    await parseCatalog(inputFilename, outputFilename, {...baseConfig});

    expect(await fileExists(outputFilename)).toBe(true);
    expect(await fileExists(path.join(tempDir, 'long-preamble-output-inventory.xml'))).toBe(true);
    expect(await fileExists(path.join(tempDir, 'long-preamble-output-pricebook.xml'))).toBe(true);
  });

  it('resolves catalog-id when catalog opening tag spans multiple lines', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'multiline-catalog-tag.xml');
    const outputFilename = path.join(tempDir, 'multiline-catalog-tag-output.xml');
    await fs.writeFile(inputFilename, buildMultilineCatalogTagXml(), 'utf8');

    await parseCatalog(inputFilename, outputFilename, {...baseConfig, total: 1});

    const catalogOutput = await fs.readFile(outputFilename, 'utf8');
    expect(catalogOutput).toMatch(/catalog-id="test-catalog"/i);
  });

  it('ignores catalog-like text inside XML comments', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'comment-with-catalog.xml');
    const outputFilename = path.join(tempDir, 'comment-with-catalog-output.xml');
    await fs.writeFile(inputFilename, buildCatalogXmlWithCatalogTextInComment(), 'utf8');

    await parseCatalog(inputFilename, outputFilename, {...baseConfig, total: 1});

    const catalogOutput = await fs.readFile(outputFilename, 'utf8');
    expect(catalogOutput).toMatch(/catalog-id="test-catalog"/i);
  });

  it('resolves catalog-id when opening tag uses single quotes', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'single-quote-catalog-tag.xml');
    const outputFilename = path.join(tempDir, 'single-quote-catalog-tag-output.xml');
    await fs.writeFile(inputFilename, buildCatalogXmlWithSingleQuotes(), 'utf8');

    await parseCatalog(inputFilename, outputFilename, {...baseConfig, total: 1});

    const catalogOutput = await fs.readFile(outputFilename, 'utf8');
    expect(catalogOutput).toMatch(/catalog-id="test-catalog"/i);
  });

  it('generates deterministic pricebook amounts for a given seed', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'seeded-input.xml');
    const outputA = path.join(tempDir, 'seeded-output-a.xml');
    const outputB = path.join(tempDir, 'seeded-output-b.xml');
    const outputC = path.join(tempDir, 'seeded-output-c.xml');
    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');

    await parseCatalog(inputFilename, outputA, {...baseConfig, total: 1, pricebookRandomSeed: 1234});
    await parseCatalog(inputFilename, outputB, {...baseConfig, total: 1, pricebookRandomSeed: 1234});
    await parseCatalog(inputFilename, outputC, {...baseConfig, total: 1, pricebookRandomSeed: 9999});

    const pricebookOutputA = await fs.readFile(path.join(tempDir, 'seeded-output-a-pricebook.xml'), 'utf8');
    const pricebookOutputB = await fs.readFile(path.join(tempDir, 'seeded-output-b-pricebook.xml'), 'utf8');
    const pricebookOutputC = await fs.readFile(path.join(tempDir, 'seeded-output-c-pricebook.xml'), 'utf8');

    expect(pricebookOutputA).toEqual(pricebookOutputB);
    expect(pricebookOutputA).not.toEqual(pricebookOutputC);
  });

  it('filters configured source pricebooks by selected products', async () => {
    const tempDir = await mkTempDir();
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
          {productId: 'TEST-PRODUCT', amount: '79.99'},
          {productId: 'OTHER-PRODUCT', amount: '999.99'}
        ]
      }),
      'utf8'
    );
    await fs.writeFile(
      salePricebookFilename,
      buildSourcePricebookXml({
        pricebookId: 'sale-prices',
        entries: [
          {productId: 'TEST-PRODUCT', amount: '49.99'},
          {productId: 'OTHER-PRODUCT', amount: '399.99'}
        ]
      }),
      'utf8'
    );

    await parseCatalog(inputFilename, outputFilename, {
      ...baseConfig,
      total: 1,
      pricebookSourceFiles: [listPricebookFilename, salePricebookFilename]
    });

    const listPricebookOutputFilename = path.join(tempDir, 'source-pricebook-output-list-pricebook.xml');
    const salePricebookOutputFilename = path.join(tempDir, 'source-pricebook-output-sale-pricebook.xml');
    const listPricebookOutput = await fs.readFile(listPricebookOutputFilename, 'utf8');
    const salePricebookOutput = await fs.readFile(salePricebookOutputFilename, 'utf8');

    expect(await fileExists(path.join(tempDir, 'source-pricebook-output-pricebook.xml'))).toBe(false);
    expect(listPricebookOutput).toMatch(/pricebook-id="list-prices"/i);
    expect(listPricebookOutput).toMatch(/product-id="TEST-PRODUCT"/i);
    expect(listPricebookOutput).toMatch(/<amount quantity="1">79\.99<\/amount>/i);
    expect(listPricebookOutput).not.toMatch(/product-id="OTHER-PRODUCT"/i);
    expect(salePricebookOutput).toMatch(/pricebook-id="sale-prices"/i);
    expect(salePricebookOutput).toMatch(/product-id="TEST-PRODUCT"/i);
    expect(salePricebookOutput).toMatch(/<amount quantity="1">49\.99<\/amount>/i);
    expect(salePricebookOutput).not.toMatch(/product-id="OTHER-PRODUCT"/i);
    expect(listPricebookOutput).not.toMatch(/catalog-reducer-pricebook/i);
    expect(salePricebookOutput).not.toMatch(/catalog-reducer-pricebook/i);
  });

  it('preserves bundled-products and shared-option markup in reduced catalog output', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'bundled-input.xml');
    const outputFilename = path.join(tempDir, 'bundled-output.xml');

    await fs.writeFile(inputFilename, buildCatalogXmlWithBundledProducts(), 'utf8');

    await parseCatalog(inputFilename, outputFilename, {
      ...baseConfig,
      total: 1,
      productIds: ['BUNDLE-PRODUCT']
    });

    const output = await fs.readFile(outputFilename, 'utf8');

    expect(output).toMatch(/<bundled-products><bundled-product\s+product-id="BUNDLE-CHILD-1"><quantity>1<\/quantity><\/bundled-product><bundled-product\s+product-id="BUNDLE-CHILD-2"><quantity>2<\/quantity><\/bundled-product><\/bundled-products>/i);
    expect(output).not.toMatch(/<bundled-products\s+product-id=/i);
    expect(output).toMatch(/<shared-option\s+option-id="consoleWarranty"\s*\/>/i);
    expect(output).not.toMatch(/option-id="\[object Object\]"/i);
  });

  it('preserves page-attributes container markup in reduced catalog output', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'page-attributes-input.xml');
    const outputFilename = path.join(tempDir, 'page-attributes-output.xml');

    await fs.writeFile(inputFilename, buildCatalogXmlWithPageAttributes(), 'utf8');

    await parseCatalog(inputFilename, outputFilename, {
      ...baseConfig,
      total: 1,
      productIds: ['PAGE-ATTR-PRODUCT']
    });

    const output = await fs.readFile(outputFilename, 'utf8');

    expect(output).toMatch(/<page-attributes><page-title\s+xml:lang="x-default">Look of the week - LOLALIZA<\/page-title><page-title\s+xml:lang="fr">Look de la semaine - LOLALIZA<\/page-title><\/page-attributes>/i);
    expect(output).not.toMatch(/<page-attributes\s+xml:lang=/i);
  });

  it('filters configured source storefront catalogs by selected products while preserving structure', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'storefront-input.xml');
    const outputFilename = path.join(tempDir, 'storefront-output.xml');
    const storefrontFilename = path.join(tempDir, 'storefront-source.xml');

    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');
    await fs.writeFile(storefrontFilename, buildStorefrontCatalogXml(), 'utf8');

    await parseCatalog(inputFilename, outputFilename, {
      ...baseConfig,
      total: 1,
      storefrontSourceFiles: [storefrontFilename]
    });

    const storefrontOutputFilename = path.join(tempDir, 'storefront-output-storefront-storefront-source.xml');
    const storefrontOutput = await fs.readFile(storefrontOutputFilename, 'utf8');

    expect(await fileExists(storefrontOutputFilename)).toBe(true);
    expect(storefrontOutput).toMatch(/catalog-id="storefront-catalog"/i);
    expect(storefrontOutput).toMatch(/<category\s+category-id="root"/i);
    expect(storefrontOutput).toMatch(/<category\s+category-id="child"/i);
    expect(storefrontOutput).toMatch(/product-id="TEST-PRODUCT"/i);
    expect(storefrontOutput).toMatch(/<primary-flag>true<\/primary-flag>/i);
    expect(storefrontOutput).not.toMatch(/product-id="OTHER-PRODUCT"/i);
  });

  it('normalizes invalid storefront numeric character references while preserving output', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'storefront-sanitized-input.xml');
    const outputFilename = path.join(tempDir, 'storefront-sanitized-output.xml');
    const storefrontFilename = path.join(tempDir, 'storefront-invalid-charrefs.xml');

    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');
    await fs.writeFile(storefrontFilename, buildStorefrontCatalogXmlWithInvalidCharRefs(), 'utf8');

    await parseCatalog(inputFilename, outputFilename, {
      ...baseConfig,
      total: 1,
      storefrontSourceFiles: [storefrontFilename]
    });

    const storefrontOutput = await fs.readFile(
      path.join(tempDir, 'storefront-sanitized-output-storefront-storefront-invalid-charrefs.xml'),
      'utf8'
    );

    expect(storefrontOutput).toMatch(/&#x1F991; Welcome/i);
    expect(storefrontOutput).not.toMatch(/&#55358;&#56721;/i);
  });

  it('preserves multiple source pricebooks from a single source file', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'multi-source-pricebook-input.xml');
    const outputFilename = path.join(tempDir, 'multi-source-pricebook-output.xml');
    const sourcePricebookFilename = path.join(tempDir, 'combined-pricebooks.xml');

    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');
    await fs.writeFile(sourcePricebookFilename, buildSourcePricebooksXml([
      {
        pricebookId: 'list-prices',
        entries: [
          {productId: 'TEST-PRODUCT', amount: '79.99'},
          {productId: 'OTHER-PRODUCT', amount: '999.99'}
        ]
      },
      {
        pricebookId: 'sale-prices',
        entries: [
          {productId: 'TEST-PRODUCT', amount: '49.99'},
          {productId: 'OTHER-PRODUCT', amount: '399.99'}
        ]
      }
    ]), 'utf8');

    await parseCatalog(inputFilename, outputFilename, {
      ...baseConfig,
      total: 1,
      pricebookSourceFiles: [sourcePricebookFilename]
    }, createSilentRuntime());

    const sourcePricebookOutput = await fs.readFile(
      path.join(tempDir, 'multi-source-pricebook-output-combined-pricebooks.xml'),
      'utf8'
    );

    expect(sourcePricebookOutput).toMatch(/pricebook-id="list-prices"/i);
    expect(sourcePricebookOutput).toMatch(/pricebook-id="sale-prices"/i);
    expect(sourcePricebookOutput).toMatch(/product-id="TEST-PRODUCT"/i);
    expect(sourcePricebookOutput).not.toMatch(/product-id="OTHER-PRODUCT"/i);
  });

  it('rejects when configured source pricebook file is missing', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'missing-source-pricebook-input.xml');
    const outputFilename = path.join(tempDir, 'missing-source-pricebook-output.xml');
    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');

    await expect(parseCatalog(inputFilename, outputFilename, {
      ...baseConfig,
      total: 1,
      pricebookSourceFiles: [path.join(tempDir, 'missing-pricebook.xml')]
    })).rejects.toThrow(/pricebook source file/i);
  });

  it('rejects when configured source storefront file is missing', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'missing-source-storefront-input.xml');
    const outputFilename = path.join(tempDir, 'missing-source-storefront-output.xml');
    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');

    await expect(parseCatalog(inputFilename, outputFilename, {
      ...baseConfig,
      total: 1,
      storefrontSourceFiles: [path.join(tempDir, 'missing-storefront.xml')]
    })).rejects.toThrow(/storefront source file/i);
  });

  it('removes stale combined pricebook output when source pricebook files are configured', async () => {
    const tempDir = await mkTempDir();
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
        entries: [{productId: 'TEST-PRODUCT', amount: '79.99'}]
      }),
      'utf8'
    );
    await fs.writeFile(
      salePricebookFilename,
      buildSourcePricebookXml({
        pricebookId: 'sale-prices',
        entries: [{productId: 'TEST-PRODUCT', amount: '49.99'}]
      }),
      'utf8'
    );
    await fs.writeFile(staleCombinedPricebookFilename, '<stale/>', 'utf8');

    await parseCatalog(inputFilename, outputFilename, {
      ...baseConfig,
      total: 1,
      pricebookSourceFiles: [listPricebookFilename, salePricebookFilename]
    });

    expect(await fileExists(staleCombinedPricebookFilename)).toBe(false);
  });

  it('ignores deprecated singlePass config and writes expected outputs', async () => {
    const tempDir = await mkTempDir();
    const warnings: unknown[][] = [];
    const originalEmitWarning = process.emitWarning;

    (process as any).emitWarning = (...args: unknown[]) => {
      warnings.push(args);
    };

    try {
      const inputFilename = path.join(tempDir, 'single-pass-input.xml');
      const outputFilename = path.join(tempDir, 'single-pass-output.xml');
      await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');

      await parseCatalog(inputFilename, outputFilename, {
        ...baseConfig,
        total: 1,
        singlePass: true
      });

      expect(await fileExists(outputFilename)).toBe(true);
      expect(await fileExists(path.join(tempDir, 'single-pass-output-inventory.xml'))).toBe(true);
      expect(await fileExists(path.join(tempDir, 'single-pass-output-pricebook.xml'))).toBe(true);

      const catalogOutput = await fs.readFile(outputFilename, 'utf8');

      expect(warnings).toHaveLength(1);
      expect(String(warnings[0][0])).toMatch(/singlePass/i);
      expect(catalogOutput).toMatch(/catalog-id="test-catalog"/i);
      expect(catalogOutput).toMatch(/<product\s+product-id="TEST-PRODUCT"/i);
    } finally {
      process.emitWarning = originalEmitWarning;
    }
  });

  it('skips pretty formatting when beautify is false', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'compact-input.xml');
    const outputFilename = path.join(tempDir, 'compact-output.xml');
    await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');

    await parseCatalog(inputFilename, outputFilename, {
      ...baseConfig,
      total: 1,
      beautify: false
    });

    const catalogOutput = await fs.readFile(outputFilename, 'utf8');

    expect(catalogOutput).toMatch(/<catalog\b[^>]*><product\b/i);
  });

  it('keeps formatted output by default when beautify is not set', async () => {
    const tempDir = await mkTempDir();
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

    await parseCatalog(inputFilename, outputFilename, configWithoutBeautify);

    const catalogOutput = await fs.readFile(outputFilename, 'utf8');

    expect(catalogOutput).toMatch(/<catalog\b[^>]*>\s*\n\s+<product\b/i);
  });

  it('can run with a silent runtime without console side effects', async () => {
    const tempDir = await mkTempDir();
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const infoCalls: unknown[][] = [];
    const warnCalls: unknown[][] = [];

    console.info = (...args: unknown[]) => {
      infoCalls.push(args);
    };

    console.warn = (...args: unknown[]) => {
      warnCalls.push(args);
    };

    try {
      const inputFilename = path.join(tempDir, 'silent-runtime-input.xml');
      const outputFilename = path.join(tempDir, 'silent-runtime-output.xml');
      await fs.writeFile(inputFilename, buildCatalogXml(), 'utf8');

      await parseCatalog(inputFilename, outputFilename, {...baseConfig, total: 1}, createSilentRuntime());

      expect(infoCalls).toHaveLength(0);
      expect(warnCalls).toHaveLength(0);
      expect(await fileExists(outputFilename)).toBe(true);
      expect(await fileExists(path.join(tempDir, 'silent-runtime-output-inventory.xml'))).toBe(true);
      expect(await fileExists(path.join(tempDir, 'silent-runtime-output-pricebook.xml'))).toBe(true);
    } finally {
      console.info = originalInfo;
      console.warn = originalWarn;
    }
  });
});

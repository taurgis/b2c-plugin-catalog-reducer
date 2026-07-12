import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it} from 'vitest';

import {buildFilterPlan, selectProducts, warnOnDeprecatedSinglePassConfig} from './selectionPipeline';
import {SelectorConfig} from './types';

const getFilterNames = (selectorConfig: SelectorConfig): string[] => buildFilterPlan(selectorConfig).map(FilterClass => FilterClass.name);

const createProgressStub = () => ({
  start: () => {},
  stop: () => {},
  update: () => {},
  setTotal: () => {}
});

describe('selectionPipeline', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, {recursive: true, force: true})));
  });

  it('buildFilterPlan preserves preferred/master selection order without standalone filler', () => {
    const filterNames = getFilterNames({
      total: 5,
      master: 1,
      productIds: ['MASTER-1'],
      attributes: {
        custom: []
      }
    });

    expect(filterNames).toEqual([
      'PreferredMasterProductsFilter',
      'MasterFilter',
      'PreferredProductsFilter'
    ]);
  });

  it('buildFilterPlan includes attribute and filler filters when custom attributes are configured', () => {
    const filterNames = getFilterNames({
      total: 2,
      master: 0,
      productIds: [],
      attributes: {
        custom: [{id: 'brand', count: 1}]
      }
    });

    expect(filterNames).toEqual([
      'AttributeFilter',
      'FillerProductsFilter'
    ]);
  });

  it('buildFilterPlan returns no filters when there are no selection targets', () => {
    expect(getFilterNames({
      total: 0,
      master: 0,
      productIds: [],
      attributes: {
        custom: []
      }
    })).toEqual([]);
  });

  it('warnOnDeprecatedSinglePassConfig only emits a warning when singlePass is present', () => {
    const warnings: unknown[][] = [];
    const originalEmitWarning = process.emitWarning;

    (process as any).emitWarning = (...args: unknown[]) => {
      warnings.push(args);
    };

    try {
      warnOnDeprecatedSinglePassConfig({total: 1});
      warnOnDeprecatedSinglePassConfig({total: 1, singlePass: true});
    } finally {
      process.emitWarning = originalEmitWarning;
    }

    expect(warnings).toHaveLength(1);
    expect(String(warnings[0][0])).toMatch(/singlePass/i);
  });

  it('selectProducts captures filler products during the preferred pass when standalone filler is omitted', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-selection-pipeline-'));
    tempDirs.push(tempDir);
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

    await fs.writeFile(inputFilename, xml, 'utf8');

    const selection = await selectProducts(inputFilename, selectorConfig, createProgressStub() as any);

    expect(selection.map(product => product.$attrs['product-id'])).toEqual(['PREFERRED-1', 'FILL-1']);
    expect(getFilterNames(selectorConfig)).toEqual([
      'PreferredMasterProductsFilter',
      'PreferredProductsFilter'
    ]);
  });

  it('captured-during-preferred-pass filler selection is category-proportional, not just first-come-first-served', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-selection-pipeline-captured-quota-'));
    tempDirs.push(tempDir);
    const inputFilename = path.join(tempDir, 'master-with-filler.xml');
    // MASTER-1's one real variant (VAR-1) is resolved by PreferredProductsFilter
    // itself, so remaining capacity is exactly totalTarget - 2 (MASTER-1 + VAR-1)
    // with no "phantom" leftover from an unresolvable variant id.
    const products = [
      '<product product-id="MASTER-1"><online-flag>true</online-flag>'
        + '<variations>'
        + '<attributes><variation-attribute attribute-id="size" variation-attribute-id="size"/></attributes>'
        + '<variants><variant product-id="VAR-1"/></variants>'
        + '</variations></product>',
      '<product product-id="VAR-1"><online-flag>true</online-flag></product>'
    ];

    for (let i = 0; i < 8; i++) {
      products.push(`<product product-id="SHOE-${i}"><online-flag>true</online-flag>`
        + '<images><image-group view-type="large"><image path="images/x.jpg"/></image-group></images>'
        + '<classification-category catalog-id="site-1">shoes</classification-category></product>');
    }

    for (let i = 0; i < 2; i++) {
      products.push(`<product product-id="HAT-${i}"><online-flag>true</online-flag>`
        + '<images><image-group view-type="large"><image path="images/x.jpg"/></image-group></images>'
        + '<classification-category catalog-id="site-1">hats</classification-category></product>');
    }

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
      + `<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="pipeline-captured-quota">${products.join('')}</catalog>`;

    await fs.writeFile(inputFilename, xml, 'utf8');

    const selectorConfig = {total: 5, master: 1, productIds: [], attributes: {custom: []}};

    expect(getFilterNames(selectorConfig)).toEqual(['MasterFilter', 'PreferredProductsFilter']);

    const selection = await selectProducts(inputFilename, selectorConfig, createProgressStub() as any);
    const ids = selection.map(product => product.$attrs['product-id']);

    // totalTarget grows from 5 to 6 (MASTER-1's one variant); MASTER-1 +
    // VAR-1 consume 2, leaving capacity 4 for the proportional 80/20 split
    // of 8 shoes / 2 hats -> floor(4*8/10)=3, floor(4*2/10)=0 (+1 remainder,
    // smallest-category-first) = 3 shoes + 1 hat. Not stream order.
    expect(ids).toEqual(expect.arrayContaining(['MASTER-1', 'VAR-1']));
    expect(ids.filter(id => id.startsWith('SHOE-')).length).toBe(3);
    expect(ids.filter(id => id.startsWith('HAT-')).length).toBe(1);
    expect(ids.length).toBe(6);
  });

  it('produces the same selection across two sequential in-process invocations with different configs (no cross-invocation state leakage)', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-selection-pipeline-multi-'));
    tempDirs.push(tempDir);
    const inputFilename = path.join(tempDir, 'catalog.xml');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="pipeline-multi">
    <product product-id="A">
        <online-flag>true</online-flag>
        <images><image-group view-type="large"><image path="images/a.jpg"/></image-group></images>
    </product>
    <product product-id="B">
        <online-flag>true</online-flag>
        <images><image-group view-type="large"><image path="images/b.jpg"/></image-group></images>
    </product>
</catalog>
`;

    await fs.writeFile(inputFilename, xml, 'utf8');

    // Run 1: no cache, useCache: false so state resolution is exercised fresh each time.
    const configA = {total: 1, master: 0, productIds: [], attributes: {custom: []}};
    const selectionRun1 = await selectProducts(inputFilename, configA, {useCache: false, enableProgress: false} as any);

    // Run 2 (same process, immediately after): a different config against the same input.
    const configB = {total: 2, master: 0, productIds: [], attributes: {custom: []}};
    const selectionRun2 = await selectProducts(inputFilename, configB, {useCache: false, enableProgress: false} as any);

    // Run 3: re-run configA again in the same process - must reproduce run 1 exactly,
    // proving no leftover state from configB's run leaked into it.
    const selectionRun3 = await selectProducts(inputFilename, configA, {useCache: false, enableProgress: false} as any);

    expect(selectionRun1.map(p => p.$attrs['product-id'])).toEqual(['A']);
    expect(selectionRun2.map(p => p.$attrs['product-id'])).toEqual(['A', 'B']);
    expect(selectionRun3.map(p => p.$attrs['product-id'])).toEqual(selectionRun1.map(p => p.$attrs['product-id']));
  });
});

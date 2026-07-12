import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it} from 'vitest';

import {ProgressBar, SelectorConfig} from '../types';
import FillerProductsFilter from './fillerProductsFilter';
import {FilterRuntimeState, FilterStatistics} from './filter';

describe('FillerProductsFilter (category-proportional selection)', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, {recursive: true, force: true})));
  });

  const createStatistics = (): FilterStatistics => ({
    total: 0,
    master: 0,
    variants: 0,
    variationGroups: 0,
    attributes: {custom: {}},
    productIds: new Set()
  });

  const createProgress = (): ProgressBar => ({
    start: () => {},
    stop: () => {},
    update: () => {},
    setTotal: () => {}
  });

  const writeTempCatalog = async (products: string[]): Promise<string> => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-filler-quota-'));
    tempDirs.push(tempDir);

    const inputFilename = path.join(tempDir, 'input.xml');
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
      + `<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="filler-quota">${products.join('')}</catalog>`;

    await fs.writeFile(inputFilename, xml, 'utf8');

    return inputFilename;
  };

  const buildImagedProduct = (id: string, categorySlug?: string): string => (
    `<product product-id="${id}">`
    + '<online-flag>true</online-flag>'
    + '<images><image-group view-type="large"><image path="images/x.jpg"/></image-group></images>'
    + (categorySlug ? `<classification-category catalog-id="site-1">${categorySlug}</classification-category>` : '')
    + '</product>'
  );

  const runFilter = async (inputFilename: string, totalTarget: number, selectorConfig: SelectorConfig = {}) => {
    const statistics = createStatistics();
    const runtimeState: FilterRuntimeState = {
      totalTarget,
      preferredProductIds: new Set()
    };
    const filter = new FillerProductsFilter(inputFilename, selectorConfig, statistics, createProgress(), runtimeState);
    const results = await filter.execute();

    return {results, statistics, ids: results.map(product => product.$attrs['product-id'])};
  };

  it('selects every eligible candidate when capacity covers them all (no trimming)', async () => {
    const inputFilename = await writeTempCatalog([
      buildImagedProduct('A', 'shoes'),
      buildImagedProduct('B', 'shoes'),
      buildImagedProduct('C', 'hats')
    ]);

    const {ids, statistics} = await runFilter(inputFilename, 3);

    expect(new Set(ids)).toEqual(new Set(['A', 'B', 'C']));
    expect(statistics.total).toBe(3);
  });

  it('falls back to first-come-first-served order when no product has a classification-category (uncategorized bucket)', async () => {
    const inputFilename = await writeTempCatalog([
      buildImagedProduct('A'),
      buildImagedProduct('B'),
      buildImagedProduct('C')
    ]);

    const {ids} = await runFilter(inputFilename, 2);

    expect(ids).toEqual(['A', 'B']);
  });

  it('distributes the selection proportionally across categories when trimming is required', async () => {
    // 8 "shoes" candidates, 2 "hats" candidates (80/20 split), capacity 5
    // -> proportional split is 4 shoes + 1 hat.
    const shoeProducts = Array.from({length: 8}, (_, i) => buildImagedProduct(`SHOE-${i}`, 'shoes'));
    const hatProducts = Array.from({length: 2}, (_, i) => buildImagedProduct(`HAT-${i}`, 'hats'));
    const inputFilename = await writeTempCatalog([...shoeProducts, ...hatProducts]);

    const {ids} = await runFilter(inputFilename, 5);

    const shoeCount = ids.filter(id => id.startsWith('SHOE-')).length;
    const hatCount = ids.filter(id => id.startsWith('HAT-')).length;

    expect(shoeCount).toBe(4);
    expect(hatCount).toBe(1);
    expect(ids.length).toBe(5);
  });

  it('excludes masters from the filler selection but still marks their variants/variation-groups as claimed', async () => {
    const inputFilename = await writeTempCatalog([
      '<product product-id="MASTER-1">'
        + '<online-flag>true</online-flag>'
        + '<variations>'
        + '<variants><variant product-id="VAR-1"/></variants>'
        + '<variation-groups><variation-group product-id="VG-1"/></variation-groups>'
        + '</variations>'
        + '</product>',
      buildImagedProduct('FILL-1', 'accessories')
    ]);

    const {ids, statistics} = await runFilter(inputFilename, 5);

    expect(ids).toEqual(['FILL-1']);
    expect(statistics.productIds.has('VAR-1')).toBe(true);
    expect(statistics.productIds.has('VG-1')).toBe(true);
  });

  it('respects existing statistics.total when computing remaining capacity (does not overshoot the configured total)', async () => {
    const inputFilename = await writeTempCatalog([
      buildImagedProduct('A', 'shoes'),
      buildImagedProduct('B', 'shoes'),
      buildImagedProduct('C', 'shoes')
    ]);

    const statistics = createStatistics();
    statistics.total = 4;
    statistics.productIds.add('ALREADY-SELECTED');
    const runtimeState: FilterRuntimeState = {totalTarget: 5, preferredProductIds: new Set()};
    const filter = new FillerProductsFilter(inputFilename, {}, statistics, createProgress(), runtimeState);

    const results = await filter.execute();

    expect(results.length).toBe(1);
    expect(statistics.total).toBe(5);
  });

  it('is deterministic across repeated runs against the same input', async () => {
    const products = [
      ...Array.from({length: 5}, (_, i) => buildImagedProduct(`SHOE-${i}`, 'shoes')),
      ...Array.from({length: 3}, (_, i) => buildImagedProduct(`HAT-${i}`, 'hats')),
      ...Array.from({length: 2}, (_, i) => buildImagedProduct(`BAG-${i}`, 'bags'))
    ];
    const inputFilename = await writeTempCatalog(products);

    const first = await runFilter(inputFilename, 6);
    const second = await runFilter(inputFilename, 6);

    expect(first.ids).toEqual(second.ids);
  });
});

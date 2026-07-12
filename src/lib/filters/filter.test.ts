import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it} from 'vitest';

import Filter, {FilterRuntimeState, FilterStatistics} from './filter';
import {ProgressBar, SelectorConfig} from '../types';

const createFilterContext = (): {
  selectorConfig: SelectorConfig;
  statistics: FilterStatistics;
  progress: ProgressBar;
  runtimeState: FilterRuntimeState;
} => {
  return {
    selectorConfig: {
      total: 1
    },
    statistics: {
      total: 0,
      master: 0,
      variants: 0,
      variationGroups: 0,
      attributes: {custom: {}},
      productIds: new Set()
    },
    progress: {
      start: () => {},
      stop: () => {},
      setTotal() {},
      update() {}
    },
    runtimeState: {
      totalTarget: 1,
      preferredProductIds: new Set()
    }
  };
};

describe('base Filter', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, {recursive: true, force: true})));
  });

  const writeTempCatalog = async (xmlBody: string): Promise<string> => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-filter-base-'));
    tempDirs.push(tempDir);

    const inputFilename = path.join(tempDir, 'input.xml');
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
      + `<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="base-filter">${xmlBody}</catalog>`;

    await fs.writeFile(inputFilename, xml, 'utf8');

    return inputFilename;
  };

  it('default process returns FINISHED and logs warning', async () => {
    const inputFilename = await writeTempCatalog(
      '<product product-id="BASE-1"><online-flag>true</online-flag></product>'
    );
    const {selectorConfig, statistics, progress, runtimeState} = createFilterContext();
    const filter = new Filter(inputFilename, selectorConfig, statistics, progress, runtimeState);
    const originalWarn = console.warn;
    const warnings: string[] = [];

    console.warn = (message: unknown) => {
      warnings.push(String(message));
    };

    try {
      const results = await filter.execute();

      expect(results).toEqual([]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(/Unable to filter product/);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('settles on XML end when no products are emitted', async () => {
    const inputFilename = await writeTempCatalog('');

    class PassiveFilter extends Filter {
      process() {
        return Filter.NOT_FINISHED;
      }
    }

    const {selectorConfig, statistics, progress, runtimeState} = createFilterContext();
    const filter = new PassiveFilter(inputFilename, selectorConfig, statistics, progress, runtimeState);
    const results = await filter.execute();

    expect(results).toEqual([]);
    expect(statistics.total).toBe(0);
  });

  it('keeps any true online-flag when onlineSiteIds is not configured', async () => {
    const inputFilename = await writeTempCatalog(
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
      process(product: any) {
        return Filter.NOT_FINISHED_WITH_PRODUCT(product);
      }
    }

    const {selectorConfig, statistics, progress, runtimeState} = createFilterContext();
    const filter = new CollectAllFilter(inputFilename, selectorConfig, statistics, progress, runtimeState);
    const results = await filter.execute();
    const keptIds = results.map(product => product.$attrs['product-id']);

    expect(keptIds).toEqual(['GLOBAL-ON', 'SITE-B-ON']);
  });

  it('restricts online status to the configured site IDs', async () => {
    const inputFilename = await writeTempCatalog(
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
      process(product: any) {
        return Filter.NOT_FINISHED_WITH_PRODUCT(product);
      }
    }

    const {selectorConfig, statistics, progress, runtimeState} = createFilterContext();
    selectorConfig.onlineSiteIds = ['SiteA'];

    const filter = new CollectAllFilter(inputFilename, selectorConfig, statistics, progress, runtimeState);
    const results = await filter.execute();
    const keptIds = results.map(product => product.$attrs['product-id']);

    expect(keptIds).toEqual(['GLOBAL-ON', 'SITE-A-ON']);
  });

  it('falls back to the global online-flag for a configured site with no explicit override', async () => {
    const inputFilename = await writeTempCatalog(
      // SiteC has no explicit override; it should inherit the true global default
      // even though this product also overrides an unrelated site (SiteA) to false.
      '<product product-id="INHERITS-GLOBAL-FOR-SITE-C">'
      + '<online-flag>true</online-flag>'
      + '<online-flag site-id="SiteA">false</online-flag>'
      + '</product>'
    );

    class CollectAllFilter extends Filter {
      process(product: any) {
        return Filter.NOT_FINISHED_WITH_PRODUCT(product);
      }
    }

    const {selectorConfig, statistics, progress, runtimeState} = createFilterContext();
    selectorConfig.onlineSiteIds = ['SiteC'];

    const filter = new CollectAllFilter(inputFilename, selectorConfig, statistics, progress, runtimeState);
    const results = await filter.execute();
    const keptIds = results.map(product => product.$attrs['product-id']);

    expect(keptIds).toEqual(['INHERITS-GLOBAL-FOR-SITE-C']);
  });
});

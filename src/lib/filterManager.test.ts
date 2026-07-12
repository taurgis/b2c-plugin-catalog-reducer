import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it} from 'vitest';

import AttributeFilter from './filters/attributeFilter';
import {FilterRuntimeState, FilterStatistics} from './filters/filter';
import FillerProductsFilter from './filters/fillerProductsFilter';
import MasterFilter from './filters/masterFilter';
import PreferredMasterProductsFilter from './filters/preferredMasterProductsFilter';
import PreferredProductsFilter from './filters/preferredProductsFilter';
import FilterManager from './filterManager';
import {ProgressBar, SelectorConfig, XmlNode} from './types';

const buildConfig = (overrides: Partial<SelectorConfig> = {}): SelectorConfig => ({
  total: 0,
  master: 0,
  productIds: [],
  attributes: {
    custom: []
  },
  ...overrides
});

const getProductIds = (selection: XmlNode[]): string[] => selection.map(product => product.$attrs['product-id']);

const createProgressStub = (): ProgressBar => ({
  start: () => {},
  stop: () => {},
  update: () => {},
  setTotal: () => {}
});

const createFilterStatistics = (): FilterStatistics => ({
  total: 0,
  master: 0,
  variants: 0,
  variationGroups: 0,
  attributes: {
    custom: {}
  },
  productIds: new Set()
});

const createPreferredProductsFilter = ({preferredProductIds = [] as string[], enableCapturedFiller = true, totalTarget = 3}: {
  preferredProductIds?: string[];
  enableCapturedFiller?: boolean;
  totalTarget?: number;
} = {}) => {
  const statistics = createFilterStatistics();
  const runtimeState: FilterRuntimeState = {
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

const buildMasterExpansionXml = (): string => {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
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

const buildAttributeThenFillerXml = (): string => {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
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

describe('FilterManager pipeline', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, {recursive: true, force: true})));
  });

  const runPipeline = async (xml: string, selectorConfig: SelectorConfig): Promise<XmlNode[]> => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-filter-pipeline-'));
    tempDirs.push(tempDir);

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

  it('preferred master expands target and deduplicates linked variants', async () => {
    const selection = await runPipeline(buildMasterExpansionXml(), buildConfig({
      total: 1,
      master: 1,
      productIds: ['MASTER-1']
    }));

    const productIds = getProductIds(selection);

    expect(productIds).toEqual(['MASTER-1', 'VAR-1', 'VAR-2']);
    expect(new Set(productIds).size).toBe(productIds.length);
    expect(productIds.includes('FILL-1')).toBe(false);
  });

  it('attribute filter selection is followed by filler products when capacity remains', async () => {
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
    }));

    const productIds = getProductIds(selection);

    expect(productIds).toEqual(['ATTR-1', 'FILL-1']);
    expect(new Set(productIds).size).toBe(productIds.length);
  });

  it('unresolved preferred product ids do not block attribute and filler selection', async () => {
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
    }));

    const productIds = getProductIds(selection);

    expect(productIds).toEqual(['ATTR-1', 'FILL-1']);
    expect(new Set(productIds).size).toBe(productIds.length);
  });

  it('filler filter marks master-linked variants and variation groups as selected', () => {
    const statistics = createFilterStatistics();
    const runtimeState: FilterRuntimeState = {
      totalTarget: 5,
      preferredProductIds: new Set()
    };
    const progress = createProgressStub();
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

    expect(result).toEqual({finished: false});
    expect(statistics.productIds.has('VAR-1')).toBe(true);
    expect(statistics.productIds.has('VG-1')).toBe(true);
  });

  it('master filter shouldSkip reflects master target progress', () => {
    const statistics = createFilterStatistics();
    const runtimeState: FilterRuntimeState = {
      totalTarget: 5,
      preferredProductIds: new Set()
    };
    const filter = new MasterFilter('unused.xml', {master: 1}, statistics, createProgressStub(), runtimeState);

    expect(filter.shouldSkip()).toBe(false);
    filter.updateStatistics('MASTER-1');
    expect(statistics.master).toBe(1);
    expect(filter.shouldSkip()).toBe(true);
    filter.updateStatistics(null);
    expect(statistics.total).toBe(1);
  });

  it('preferred products filter selects preferred ids and skip behavior reflects capture mode', () => {
    const {filter, runtimeState} = createPreferredProductsFilter({
      preferredProductIds: ['PREF-1'],
      enableCapturedFiller: true
    });

    const selectedResult = filter.process({
      $attrs: {
        'product-id': 'PREF-1'
      }
    });

    expect(selectedResult).toEqual({
      finished: false,
      selection: {
        $attrs: {
          'product-id': 'PREF-1'
        }
      }
    });
    expect(runtimeState.preferredProductIds.size).toBe(0);

    expect(filter.shouldSkip()).toBe(false);

    runtimeState.enableCapturedFiller = false;
    expect(filter.shouldSkip()).toBe(true);
  });

  it('preferred products filter captures filler candidates and excludes master-linked products', () => {
    const {filter, runtimeState} = createPreferredProductsFilter({
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

    expect(runtimeState.fillerExcludedProductIds!.has('VAR-1')).toBe(true);
    expect(runtimeState.fillerExcludedProductIds!.has('VG-1')).toBe(true);

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

    expect(runtimeState.fillerCandidates!.length).toBe(0);

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

    expect(runtimeState.fillerCandidates!.length).toBe(1);
    expect(runtimeState.fillerCandidates![0].$attrs['product-id']).toBe('FILL-1');
  });
});

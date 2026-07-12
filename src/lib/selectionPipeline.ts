import chalk from 'chalk';

import AttributeFilter from './filters/attributeFilter';
import Filter from './filters/filter';
import FillerProductsFilter from './filters/fillerProductsFilter';
import MasterFilter from './filters/masterFilter';
import PreferredMasterProductsFilter from './filters/preferredMasterProductsFilter';
import PreferredProductsFilter from './filters/preferredProductsFilter';
import FilterManager from './filterManager';
import {normalizeRuntimeOptions} from './runtimeSupport';
import * as selectionCache from './selectionCache';
import {
  canCaptureFillerDuringPreferredPass,
  hasAnySelectionTarget,
  hasCustomAttributeSelection,
  hasMasterSelection,
  hasPreferredProductIds
} from './selectionConfig';
import {RuntimeOptions, SelectorConfig, XmlNode} from './types';

type FilterClass = typeof Filter;

export const buildFilterPlan = (selectorConfig: SelectorConfig): FilterClass[] => {
  const filters: FilterClass[] = [];

  if (hasPreferredProductIds(selectorConfig)) {
    filters.push(PreferredMasterProductsFilter);
  }

  if (hasMasterSelection(selectorConfig)) {
    filters.push(MasterFilter);
  }

  if (hasPreferredProductIds(selectorConfig) || hasMasterSelection(selectorConfig)) {
    filters.push(PreferredProductsFilter);
  }

  if (hasCustomAttributeSelection(selectorConfig) && hasAnySelectionTarget(selectorConfig)) {
    filters.push(AttributeFilter);
  }

  // When master/preferred selection is already doing a full-file pass,
  // PreferredProductsFilter opportunistically captures filler candidates
  // (untruncated, tagged by category - see preferredProductsFilter.ts and
  // FilterManager#appendCapturedFillerSelection) during that same pass
  // instead of paying for a second one here. FillerProductsFilter only
  // runs its own standalone pass when that optimization doesn't apply
  // (custom attributes configured, or neither master nor preferred
  // selection is - e.g. a total-only config).
  if (hasAnySelectionTarget(selectorConfig) && !canCaptureFillerDuringPreferredPass(selectorConfig)) {
    filters.push(FillerProductsFilter);
  }

  return filters;
};

export const warnOnDeprecatedSinglePassConfig = (selectorConfig: SelectorConfig): void => {
  if (!selectorConfig || !Object.prototype.hasOwnProperty.call(selectorConfig, 'singlePass')) {
    return;
  }

  process.emitWarning(
    'The selector config field "singlePass" is no longer supported and is ignored; multi-pass selection is always used.',
    {
      code: 'CATALOG_REDUCER_SINGLE_PASS_DEPRECATED',
      type: 'DeprecationWarning'
    }
  );
};

const computeSelection = async (inputFilename: string, selectorConfig: SelectorConfig, runtime: RuntimeOptions): Promise<XmlNode[]> => {
  const filterManager = new FilterManager(inputFilename, selectorConfig, runtime);
  const filterPlan = buildFilterPlan(selectorConfig);

  for (let i = 0; i < filterPlan.length; i++) {
    filterManager.registerFilter(filterPlan[i] as any);
  }

  await filterManager.executeFilters();

  return filterManager.getSelection();
};

/**
 * Resolve the product selection for a run: applies the configured filters,
 * reusing a selection cached from a prior run when the input file and
 * config are unchanged and caching is enabled. A dry run never persists a
 * freshly computed selection to the cache.
 */
export const selectProducts = async (
  inputFilename: string,
  selectorConfig: SelectorConfig,
  runtimeOptions?: RuntimeOptions
): Promise<XmlNode[]> => {
  const runtime = normalizeRuntimeOptions(runtimeOptions);

  warnOnDeprecatedSinglePassConfig(selectorConfig);

  if (!runtime.useCache) {
    return computeSelection(inputFilename, selectorConfig, runtime);
  }

  const {cacheHit, selection} = await selectionCache.getOrCompute(inputFilename, selectorConfig, {
    compute: () => computeSelection(inputFilename, selectorConfig, runtime),
    persist: !runtime.dryRun
  });

  if (cacheHit) {
    runtime.logger.info(chalk.green('Using cached product selection (source file and config unchanged)'));
  }

  return selection;
};

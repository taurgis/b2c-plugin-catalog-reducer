const chalk = require('chalk');
const FilterManager = require('./filterManager');
const MasterFilter = require('./filters/masterFilter');
const PreferredMasterProductsFilter = require('./filters/preferredMasterProductsFilter');
const PreferredProductsFilter = require('./filters/preferredProductsFilter');
const AttributeFilter = require('./filters/attributeFilter');
const FillerProductsFilter = require('./filters/fillerProductsFilter');
const { normalizeRuntimeOptions } = require('./runtimeSupport');
const selectionCache = require('./selectionCache');
const {
    canCaptureFillerDuringPreferredPass,
    hasAnySelectionTarget,
    hasCustomAttributeSelection,
    hasMasterSelection,
    hasPreferredProductIds
} = require('./selectionConfig');

const buildFilterPlan = selectorConfig => {
    const filters = [];

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

    if (hasAnySelectionTarget(selectorConfig) && !canCaptureFillerDuringPreferredPass(selectorConfig)) {
        filters.push(FillerProductsFilter);
    }

    return filters;
};

const warnOnDeprecatedSinglePassConfig = selectorConfig => {
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

const computeSelection = async (inputFilename, selectorConfig, runtime) => {
    const filterManager = new FilterManager(inputFilename, selectorConfig, runtime);
    const filterPlan = buildFilterPlan(selectorConfig);

    for (let i = 0; i < filterPlan.length; i++) {
        filterManager.registerFilter(filterPlan[i]);
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
const selectProducts = async (inputFilename, selectorConfig, runtimeOptions) => {
    const runtime = normalizeRuntimeOptions(runtimeOptions);

    warnOnDeprecatedSinglePassConfig(selectorConfig);

    if (!runtime.useCache) {
        return computeSelection(inputFilename, selectorConfig, runtime);
    }

    const { cacheHit, selection } = await selectionCache.getOrCompute(inputFilename, selectorConfig, {
        compute: () => computeSelection(inputFilename, selectorConfig, runtime),
        persist: !runtime.dryRun
    });

    if (cacheHit) {
        runtime.logger.info(chalk.green('Using cached product selection (source file and config unchanged)'));
    }

    return selection;
};

module.exports = {
    buildFilterPlan,
    selectProducts,
    warnOnDeprecatedSinglePassConfig
};
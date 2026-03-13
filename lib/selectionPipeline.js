const FilterManager = require('./filterManager');
const MasterFilter = require('./filters/masterFilter');
const PreferredMasterProductsFilter = require('./filters/preferredMasterProductsFilter');
const PreferredProductsFilter = require('./filters/preferredProductsFilter');
const AttributeFilter = require('./filters/attributeFilter');
const FillerProductsFilter = require('./filters/fillerProductsFilter');
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

const selectProducts = async (inputFilename, selectorConfig, progress) => {
    const filterManager = new FilterManager(inputFilename, selectorConfig, progress);
    const filterPlan = buildFilterPlan(selectorConfig);

    warnOnDeprecatedSinglePassConfig(selectorConfig);

    for (let i = 0; i < filterPlan.length; i++) {
        filterManager.registerFilter(filterPlan[i]);
    }

    await filterManager.executeFilters();

    return filterManager.getSelection();
};

module.exports = {
    buildFilterPlan,
    selectProducts,
    warnOnDeprecatedSinglePassConfig
};
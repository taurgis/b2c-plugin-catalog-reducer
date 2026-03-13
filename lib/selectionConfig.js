const hasPreferredProductIds = selectorConfig => {
    return Array.isArray(selectorConfig && selectorConfig.productIds) && selectorConfig.productIds.length > 0;
};

const hasCustomAttributeSelection = selectorConfig => {
    const customAttributes = selectorConfig && selectorConfig.attributes && selectorConfig.attributes.custom;

    return Array.isArray(customAttributes) && customAttributes.length > 0;
};

const hasMasterSelection = selectorConfig => Number(selectorConfig && selectorConfig.master) > 0;

const hasAnySelectionTarget = selectorConfig => {
    return Number(selectorConfig && selectorConfig.total) > 0
        || hasMasterSelection(selectorConfig)
        || hasPreferredProductIds(selectorConfig);
};

const canCaptureFillerDuringPreferredPass = selectorConfig => {
    return !hasCustomAttributeSelection(selectorConfig)
        && (hasPreferredProductIds(selectorConfig) || hasMasterSelection(selectorConfig));
};

module.exports = {
    canCaptureFillerDuringPreferredPass,
    hasAnySelectionTarget,
    hasCustomAttributeSelection,
    hasMasterSelection,
    hasPreferredProductIds
};
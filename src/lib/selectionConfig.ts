import {SelectorConfig} from './types';

export const hasPreferredProductIds = (selectorConfig: SelectorConfig): boolean => {
  return Array.isArray(selectorConfig && selectorConfig.productIds) && selectorConfig.productIds.length > 0;
};

export const hasCustomAttributeSelection = (selectorConfig: SelectorConfig): boolean => {
  const customAttributes = selectorConfig && selectorConfig.attributes && selectorConfig.attributes.custom;

  return Array.isArray(customAttributes) && customAttributes.length > 0;
};

export const hasMasterSelection = (selectorConfig: SelectorConfig): boolean => Number(selectorConfig && selectorConfig.master) > 0;

export const hasAnySelectionTarget = (selectorConfig: SelectorConfig): boolean => {
  return Number(selectorConfig && selectorConfig.total) > 0
    || hasMasterSelection(selectorConfig)
    || hasPreferredProductIds(selectorConfig);
};

export const canCaptureFillerDuringPreferredPass = (selectorConfig: SelectorConfig): boolean => {
  return !hasCustomAttributeSelection(selectorConfig)
    && (hasPreferredProductIds(selectorConfig) || hasMasterSelection(selectorConfig));
};

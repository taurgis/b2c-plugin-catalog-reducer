import {XmlNode} from './types';

export const isMaster = (product: XmlNode): boolean => {
  if (!product || !product.variations || !product.variations.variants) {
    return false;
  }

  if (Array.isArray(product.variations.variants)) {
    return product.variations.variants.length > 0;
  }

  return true;
};

export const hasCustomAttribute = (product: XmlNode, attributeId: string, value?: unknown): boolean => {
  const customAttributes = product && product['custom-attributes'];

  if (!customAttributes) {
    return false;
  }

  const attributes: XmlNode[] = Array.isArray(customAttributes) ? customAttributes : [customAttributes];
  const requiresValueMatch = !(value === undefined || value === null);

  for (let i = 0; i < attributes.length; i++) {
    const attribute = attributes[i];

    if (!attribute || !attribute.$attrs || attribute.$attrs['attribute-id'] !== attributeId) {
      continue;
    }

    if (!requiresValueMatch || attribute.$text === value) {
      return true;
    }
  }

  return false;
};

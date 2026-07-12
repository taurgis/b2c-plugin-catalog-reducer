import {toArray} from '../modelNormalization';
import {XmlNode} from '../types';

const PAGE_ATTRIBUTE_KEYS = ['page-title', 'page-description', 'page-keywords', 'page-url'];

export default function fixPageAttributes(product: XmlNode, modifiedProduct: XmlNode): void {
  const pageAttributes = product['page-attributes'];

  if (!pageAttributes || typeof pageAttributes !== 'object' || Array.isArray(pageAttributes)) {
    return;
  }

  const normalizedPageAttributes: Record<string, any> = {};
  let hasPageAttributeChildren = false;

  for (let i = 0; i < PAGE_ATTRIBUTE_KEYS.length; i++) {
    const key = PAGE_ATTRIBUTE_KEYS[i];

    if (pageAttributes[key] !== undefined) {
      normalizedPageAttributes[key] = toArray(pageAttributes[key]);
      hasPageAttributeChildren = true;
    }
  }

  if (!hasPageAttributeChildren) {
    return;
  }

  modifiedProduct['page-attributes'] = normalizedPageAttributes;
}

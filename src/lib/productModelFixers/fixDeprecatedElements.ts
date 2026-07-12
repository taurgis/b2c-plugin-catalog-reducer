import {XmlNode} from '../types';

// Elements SFCC's own catalog XSD marks as deprecated in favor of the
// equivalent field under <store-attributes> (see xsd/catalog.xsd
// annotations on each element below). Stripping them avoids shipping
// dead/duplicate data in reduced fixtures.
export const DEPRECATED_CATALOG_ELEMENT_KEYS = [
  'store-force-price-flag',
  'store-non-inventory-flag',
  'store-non-revenue-flag',
  'store-non-discountable-flag'
];

export default function fixDeprecatedElements(_product: XmlNode, modifiedProduct: XmlNode): void {
  for (const key of DEPRECATED_CATALOG_ELEMENT_KEYS) {
    delete modifiedProduct[key];
  }
}

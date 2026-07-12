// Runs the (already-normalized, per lib/normalizeSelectedProducts.js)
// product selection pass and wraps it into the catalog document shape ready
// for XML serialization. Split out of the legacy monolithic lib/parser.js.
import {selectProducts} from '../selectionPipeline';
import {NormalizedRuntime, SelectorConfig, XmlNode} from '../types';
import {CATALOG_XML_NAMESPACE} from './xmlSerialization';

export const buildSelection = (catalogId: string, products: XmlNode[]): XmlNode => ({
  $name: 'catalog',
  product: products,
  $attrs: {
    xmlns: CATALOG_XML_NAMESPACE,
    'catalog-id': catalogId
  }
});

export const selectAndNormalizeProducts = async (
  inputFilename: string,
  selectorConfig: SelectorConfig,
  runtime: NormalizedRuntime
): Promise<XmlNode[]> => selectProducts(inputFilename, selectorConfig, runtime);

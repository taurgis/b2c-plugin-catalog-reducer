import ProductModelFixers from './productModelFixers';
import {XmlNode} from './types';

export const normalizeProductForOutput = (product: XmlNode): XmlNode => {
  // Keep the clone shallow for performance; fixers overwrite transformed branches explicitly.
  const sourceProduct = product;
  const modifiedProduct: XmlNode = {
    ...product
  };

  ProductModelFixers.fixCustomAttributes(sourceProduct, modifiedProduct);
  ProductModelFixers.fixVariants(sourceProduct, modifiedProduct);
  ProductModelFixers.fixImages(sourceProduct, modifiedProduct);
  ProductModelFixers.fixOptions(sourceProduct, modifiedProduct);
  ProductModelFixers.fixPageAttributes(sourceProduct, modifiedProduct);
  ProductModelFixers.fixProductSetProducts(sourceProduct, modifiedProduct);
  ProductModelFixers.fixBundledProducts(sourceProduct, modifiedProduct);
  ProductModelFixers.fixDeprecatedElements(sourceProduct, modifiedProduct);

  return modifiedProduct;
};

export const normalizeSelectedProducts = (selectedProducts: XmlNode[]): XmlNode[] => selectedProducts.map(normalizeProductForOutput);

import fixOptions from './productModelFixers/fixOptions';
import fixCustomAttributes from './productModelFixers/fixCustomAttributes';
import fixPageAttributes from './productModelFixers/fixPageAttributes';
import fixProductSetProducts from './productModelFixers/fixProductSetProducts';
import fixBundledProducts from './productModelFixers/fixBundledProducts';
import fixImages from './productModelFixers/fixImages';
import fixDeprecatedElements from './productModelFixers/fixDeprecatedElements';
import {fixVariants, fixVariationVariants, fixVariationAttributes} from './productModelFixers/fixVariants';
import {XmlNode} from './types';

export default class ProductModelFixers {
  static fixOptions(product: XmlNode, modifiedProduct: XmlNode): void {
    return fixOptions(product, modifiedProduct);
  }

  static fixCustomAttributes(product: XmlNode, modifiedProduct: XmlNode): void {
    return fixCustomAttributes(product, modifiedProduct);
  }

  static fixPageAttributes(product: XmlNode, modifiedProduct: XmlNode): void {
    return fixPageAttributes(product, modifiedProduct);
  }

  static fixProductSetProducts(product: XmlNode, modifiedProduct: XmlNode): void {
    return fixProductSetProducts(product, modifiedProduct);
  }

  static fixBundledProducts(product: XmlNode, modifiedProduct: XmlNode): void {
    return fixBundledProducts(product, modifiedProduct);
  }

  static fixVariants(product: XmlNode, modifiedProduct: XmlNode): void {
    return fixVariants(product, modifiedProduct);
  }

  static fixVariationVariants(product: XmlNode, modifiedProduct: XmlNode): void {
    return fixVariationVariants(product, modifiedProduct);
  }

  static fixVariationAttributes(product: XmlNode, modifiedProduct: XmlNode): void {
    return fixVariationAttributes(product, modifiedProduct);
  }

  static fixImages(product: XmlNode, modifiedProduct: XmlNode): void {
    return fixImages(product, modifiedProduct);
  }

  static fixDeprecatedElements(product: XmlNode, modifiedProduct: XmlNode): void {
    return fixDeprecatedElements(product, modifiedProduct);
  }
}

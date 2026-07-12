import * as selectors from '../selectors';
import {XmlNode} from '../types';
import Filter, {FilterResult} from './filter';

/**
 * Fetch products from the XML that have not been filtered out
 */
export default class FillerProductsFilter extends Filter {
  static usesStandaloneFillerCapture = true;

  shouldSkip(): boolean {
    return !this.hasCapacity();
  }

  process(product: XmlNode): FilterResult {
    if (this.hasCapacity()) {
      const isMaster = selectors.isMaster(product);

      if (!isMaster && product.images) {
        return Filter.NOT_FINISHED_WITH_PRODUCT(product);
      } else {
        if (product.variations) {
          const {variants, variationGroups} = this.getMasterLinkedProductIds(product);

          // If there are variants or variation groups add them to the already selected list to be filtered out.
          variants.forEach(productId => this.markSelectedProductId(productId));
          variationGroups.forEach(productId => this.markSelectedProductId(productId));
        }
      }

      return Filter.NOT_FINISHED;
    }

    return Filter.FINISHED;
  }
}

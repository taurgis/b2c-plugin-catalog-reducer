import * as selectors from '../selectors';
import {XmlNode} from '../types';
import Filter, {FilterResult} from './filter';

/**
 * Filter out the preferred products from the given XML.
 */
export default class PreferredMasterProductsFilter extends Filter {
  shouldSkip(): boolean {
    return !this.hasCapacity() || !this.runtimeState.preferredProductIds.size;
  }

  process(product: XmlNode): FilterResult {
    if (this.hasCapacity()) {
      if (product && this.runtimeState.preferredProductIds.size) {
        const productId = product.$attrs['product-id'];
        const isMaster = selectors.isMaster(product);

        if (isMaster && this.runtimeState.preferredProductIds.has(productId)) {
          this.runtimeState.preferredProductIds.delete(productId);
          this.processMasterProduct(product);

          return Filter.NOT_FINISHED_WITH_PRODUCT(product);
        }

        return Filter.NOT_FINISHED;
      }
    }

    return Filter.FINISHED;
  }
}

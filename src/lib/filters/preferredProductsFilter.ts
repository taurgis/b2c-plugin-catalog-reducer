import * as selectors from '../selectors';
import {XmlNode} from '../types';
import Filter, {FilterResult} from './filter';

/**
 * Filter out the preferred products from the given XML.
 */
export default class PreferredProductsFilter extends Filter {
  captureFillerCandidate(product: XmlNode, isMasterProduct: boolean): void {
    if (!this.runtimeState.enableCapturedFiller || !this.hasCapacity()) {
      return;
    }

    const productId = product && product.$attrs ? product.$attrs['product-id'] : null;

    if (!productId) {
      return;
    }

    if (isMasterProduct) {
      const {variants, variationGroups} = this.getMasterLinkedProductIds(product);

      variants.forEach(variantId => this.runtimeState.fillerExcludedProductIds!.add(variantId));
      variationGroups.forEach(variationGroupId => this.runtimeState.fillerExcludedProductIds!.add(variationGroupId));
      return;
    }

    if (!product.images || this.runtimeState.fillerExcludedProductIds!.has(productId)) {
      return;
    }

    if (this.runtimeState.fillerCandidates!.length >= this.runtimeState.totalTarget) {
      return;
    }

    this.runtimeState.fillerCandidates!.push(product);
  }

  shouldSkip(): boolean {
    return !this.hasCapacity() || (!this.runtimeState.preferredProductIds.size && !this.runtimeState.enableCapturedFiller);
  }

  process(product: XmlNode): FilterResult {
    if (this.hasCapacity()) {
      if (product) {
        const productId = product.$attrs['product-id'];

        if (this.runtimeState.preferredProductIds.has(productId)) {
          this.runtimeState.preferredProductIds.delete(productId);

          return Filter.NOT_FINISHED_WITH_PRODUCT(product);
        }

        this.captureFillerCandidate(product, selectors.isMaster(product));

        return Filter.NOT_FINISHED;
      }
    }

    return Filter.FINISHED;
  }
}

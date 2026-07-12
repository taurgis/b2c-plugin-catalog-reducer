import * as selectors from '../selectors';
import {XmlNode} from '../types';
import Filter, {FilterResult} from './filter';

// Bounds how many filler candidates get buffered in memory during the
// opportunistic capture pass below. Deliberately generous (not capped to
// the configured total, unlike the pre-category-awareness behavior this
// replaced) since FilterManager#appendCapturedFillerSelection needs a
// representative view of every category's true size to compute accurate
// proportional quotas (see ../categoryQuota.ts) - a small cap would bias
// quotas toward whatever categories happened to stream first. Still a
// hard ceiling, though: this tool targets multi-GB catalog exports parsed
// in-process, so buffering literally every eligible candidate in an
// image-heavy catalog is a real OOM risk without some bound.
const MINIMUM_CAPTURED_FILLER_CANDIDATES = 5000;
const CAPTURED_FILLER_CANDIDATES_MULTIPLIER = 50;

/**
 * Filter out the preferred products from the given XML.
 *
 * When standalone filler selection is skipped (see
 * selectionPipeline.ts's canCaptureFillerDuringPreferredPass), this filter
 * also opportunistically captures eligible filler candidates it passes
 * over during this same pass, up to a generous cap (see above) - not the
 * configured total itself, since FilterManager#appendCapturedFillerSelection
 * needs a representative view of every category to compute accurate
 * category-proportional quotas (see ../categoryQuota.ts).
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

    const maxCapturedCandidates = Math.max(
      this.runtimeState.totalTarget * CAPTURED_FILLER_CANDIDATES_MULTIPLIER,
      MINIMUM_CAPTURED_FILLER_CANDIDATES
    );

    if (this.runtimeState.fillerCandidates!.length >= maxCapturedCandidates) {
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

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
//
// Known limitation: any finite cap can still reintroduce the same
// first-streamed-category bias this comment warns against, once a catalog
// has more eligible candidates than the cap allows - the cap only raises
// the catalog size at which that becomes possible. A fully bias-proof fix
// would need per-category bounded capture (e.g. reservoir sampling) rather
// than one global cap; that is a larger change to the capture/quota
// pipeline than this constant tune, so `captureFillerCandidate` below logs
// a warning the first time the cap is actually hit, making the risk this
// comment describes observable instead of silent.
const MINIMUM_CAPTURED_FILLER_CANDIDATES = 5000;
const MAXIMUM_CAPTURED_FILLER_CANDIDATES = 250000;
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
  private maxCapturedCandidates?: number;
  private hasWarnedAboutCapturedFillerCap = false;

  // `totalTarget` is already stable by the time this filter's pass runs
  // (only the earlier master-product passes mutate it), so this cap is
  // computed once and cached rather than recomputed on every candidate.
  private getMaxCapturedCandidates(): number {
    if (this.maxCapturedCandidates === undefined) {
      this.maxCapturedCandidates = Math.min(
        Math.max(this.runtimeState.totalTarget * CAPTURED_FILLER_CANDIDATES_MULTIPLIER, MINIMUM_CAPTURED_FILLER_CANDIDATES),
        MAXIMUM_CAPTURED_FILLER_CANDIDATES
      );
    }

    return this.maxCapturedCandidates;
  }

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

    if (this.runtimeState.fillerCandidates!.length >= this.getMaxCapturedCandidates()) {
      if (!this.hasWarnedAboutCapturedFillerCap) {
        this.hasWarnedAboutCapturedFillerCap = true;
        this.logger.warn(
          `Reached the captured-filler-candidate cap (${this.getMaxCapturedCandidates()}). `
          + 'Categories not yet seen in the source file may be under-represented in the '
          + 'category-proportional filler selection.'
        );
      }

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

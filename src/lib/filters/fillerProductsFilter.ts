import {getCategoryKey, selectByCategoryQuota} from '../categoryQuota';
import * as selectors from '../selectors';
import {XmlNode} from '../types';
import Filter from './filter';

/**
 * Fills remaining capacity with non-master products that have images.
 *
 * Only runs its own dedicated pass when PreferredProductsFilter can't
 * opportunistically capture filler candidates during its own pass instead
 * (see selectionPipeline.ts's canCaptureFillerDuringPreferredPass and
 * FilterManager#appendCapturedFillerSelection, which share the same
 * category-proportional selection logic via ../categoryQuota.ts). Unlike
 * the other filters, this one can't decide as it streams: a
 * category-proportional selection needs to know the full candidate pool
 * (and each category's size) before it can compute quotas, so every
 * eligible candidate is buffered for one full pass over the file.
 */
export default class FillerProductsFilter extends Filter {
  static usesStandaloneFillerCapture = true;

  shouldSkip(): boolean {
    return !this.hasCapacity();
  }

  execute(): Promise<XmlNode[]> {
    const candidatesByCategory = new Map<string, XmlNode[]>();

    return new Promise<XmlNode[]>((resolve, reject) => {
      const {stream, xml} = this.openStream();
      let isSettled = false;

      const teardown = (): void => {
        if (typeof xml.pause === 'function') {
          xml.pause();
        }

        if (stream && !stream.destroyed) {
          stream.destroy();
        }

        xml.removeAllListeners('tag:product');
        xml.removeAllListeners('error');
        xml.removeAllListeners('end');
      };

      const settle = (error?: unknown): void => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        teardown();

        if (error) {
          reject(error);
          return;
        }

        resolve(this.#selectFromCandidates(candidatesByCategory));
      };

      xml.on('tag:product', (product: XmlNode) => {
        try {
          const productId = product && product.$attrs ? product.$attrs['product-id'] : null;

          if (!productId || this.statistics.productIds.has(productId)) {
            return;
          }

          if (!this.isProductOnline(product)) {
            return;
          }

          const isMaster = selectors.isMaster(product);

          if (!isMaster && product.images) {
            const categoryKey = getCategoryKey(product);
            const bucket = candidatesByCategory.get(categoryKey);

            if (bucket) {
              bucket.push(product);
            } else {
              candidatesByCategory.set(categoryKey, [product]);
            }

            return;
          }

          // Mirrors the prior single-pass behavior: a master (or a
          // non-master with no images that still carries a <variations>
          // block) has its variant/variation-group IDs marked as already
          // selected so they aren't later mistaken for standalone filler
          // candidates, even though the master itself isn't chosen here.
          if (product.variations) {
            const {variants, variationGroups} = this.getMasterLinkedProductIds(product);

            variants.forEach(id => this.markSelectedProductId(id));
            variationGroups.forEach(id => this.markSelectedProductId(id));
          }
        } catch (e) {
          settle(e);
        }
      });

      xml.on('error', error => settle(error));
      xml.on('end', () => settle());
    });
  }

  #selectFromCandidates = (candidatesByCategory: Map<string, XmlNode[]>): XmlNode[] => {
    const capacity = Math.max(0, this.runtimeState.totalTarget - this.statistics.total);
    const selected = selectByCategoryQuota(candidatesByCategory, capacity);

    selected.forEach(product => {
      const productId = product.$attrs['product-id'];

      this.updateStatistics(productId);
      this.progress.update(this.statistics.total, {
        productId,
        filter: this.constructor.name
      });
    });

    return selected;
  };
}

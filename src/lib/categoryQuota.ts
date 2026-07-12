// Pure, stream-agnostic category-proportional quota apportionment for
// filler product selection. Two call sites share this: the standalone
// FillerProductsFilter pass, and FilterManager's opportunistic capture of
// filler candidates during PreferredProductsFilter's own pass (used
// instead, when available, to avoid a second full-file scan - see
// selectionPipeline.ts's canCaptureFillerDuringPreferredPass). Kept
// separate from the streaming/XML concerns so the allocation rule itself is
// independently unit-testable and easy to reason about.
//
// Rule (deterministic, documented so a future config author can predict it
// without reading this file):
//   1. If every eligible candidate fits within the remaining capacity, take
//      all of them - no category math needed. This is also the fallback for
//      catalogs/configs with no usable category data: every candidate lands
//      in one "uncategorized" bucket, so this branch degenerates to the
//      original first-come-first-served behavior.
//   2. Otherwise, each category's base quota is `floor(capacity * size /
//      totalCandidates)` - proportional to how many eligible candidates that
//      category contributes. Because capacity < totalCandidates in this
//      branch, a bucket's base quota can never exceed its own size.
//   3. The capacity left over after rounding down (`remainder`) is handed
//      out one unit at a time to categories that still have unclaimed
//      candidates, smallest-category-first (to maximize how many distinct
//      categories end up represented), tie-broken by the fractional part
//      that was rounded away, then by category key for full determinism.
export interface CategoryQuotaBucket {
  key: string;
  size: number;
}

export const computeCategoryQuotas = (buckets: CategoryQuotaBucket[], capacity: number): Map<string, number> => {
  const quotas = new Map<string, number>(buckets.map(bucket => [bucket.key, 0]));

  if (capacity <= 0 || buckets.length === 0) {
    return quotas;
  }

  const totalCandidates = buckets.reduce((sum, bucket) => sum + bucket.size, 0);

  if (totalCandidates <= capacity) {
    buckets.forEach(bucket => quotas.set(bucket.key, bucket.size));
    return quotas;
  }

  const shares = buckets.map(bucket => {
    const rawShare = (capacity * bucket.size) / totalCandidates;
    const baseQuota = Math.floor(rawShare);

    return {
      key: bucket.key,
      size: bucket.size,
      baseQuota,
      fraction: rawShare - baseQuota
    };
  });

  shares.forEach(share => quotas.set(share.key, share.baseQuota));

  let remainder = capacity - shares.reduce((sum, share) => sum + share.baseQuota, 0);

  const bonusOrder = [...shares].sort((a, b) => (
    a.size - b.size
    || b.fraction - a.fraction
    || a.key.localeCompare(b.key)
  ));

  while (remainder > 0) {
    let placedInPass = false;

    for (const share of bonusOrder) {
      if (remainder <= 0) {
        break;
      }

      const currentQuota = quotas.get(share.key)!;

      if (currentQuota < share.size) {
        quotas.set(share.key, currentQuota + 1);
        remainder -= 1;
        placedInPass = true;
      }
    }

    // Every bucket is already at capacity - nothing left to hand the
    // remainder to (should not happen given totalCandidates > capacity,
    // but guards against an infinite loop rather than assuming it can't).
    if (!placedInPass) {
      break;
    }
  }

  return quotas;
};

export const UNCATEGORIZED_CATEGORY_KEY = '__uncategorized__';

/**
 * A product's classification-category text value (see xsd/catalog.xsd -
 * complexType.Product.ClassificationCategory), or the uncategorized
 * sentinel bucket when absent. Catalogs/configs with no classification
 * data at all put every candidate in this one bucket, which naturally
 * degenerates computeCategoryQuotas to "take the first N candidates" -
 * the same behavior filler selection had before category-awareness.
 */
export const getCategoryKey = (product: Record<string, any>): string => {
  const classificationCategory = product['classification-category'];
  const entry = Array.isArray(classificationCategory) ? classificationCategory[0] : classificationCategory;

  if (entry && typeof entry === 'object' && typeof entry.$text === 'string' && entry.$text.length > 0) {
    return entry.$text;
  }

  if (typeof entry === 'string' && entry.length > 0) {
    return entry;
  }

  return UNCATEGORIZED_CATEGORY_KEY;
};

/**
 * Groups candidates by category (see getCategoryKey) and selects up to
 * each category's proportional quota (see computeCategoryQuotas),
 * processing categories smallest-first so niche categories aren't starved
 * by rounding leftovers going to larger ones first.
 */
export const selectByCategoryQuota = <T>(candidatesByCategory: Map<string, T[]>, capacity: number): T[] => {
  const buckets: CategoryQuotaBucket[] = [...candidatesByCategory.entries()].map(([key, items]) => ({key, size: items.length}));
  const quotas = computeCategoryQuotas(buckets, capacity);
  const orderedCategoryKeys = [...candidatesByCategory.keys()].sort((a, b) => (
    candidatesByCategory.get(a)!.length - candidatesByCategory.get(b)!.length
    || a.localeCompare(b)
  ));
  const selected: T[] = [];

  for (const categoryKey of orderedCategoryKeys) {
    const quota = quotas.get(categoryKey) || 0;
    const candidates = candidatesByCategory.get(categoryKey)!;

    for (let i = 0; i < quota && i < candidates.length; i++) {
      selected.push(candidates[i]);
    }
  }

  return selected;
};

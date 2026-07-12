import {describe, expect, it} from 'vitest';

import {
  canCaptureFillerDuringPreferredPass,
  hasAnySelectionTarget,
  hasCustomAttributeSelection,
  hasMasterSelection,
  hasPreferredProductIds
} from './selectionConfig';

describe('selectionConfig', () => {
  it('hasPreferredProductIds returns true only for non-empty arrays', () => {
    expect(hasPreferredProductIds({productIds: ['A']})).toBe(true);
    expect(hasPreferredProductIds({productIds: []})).toBe(false);
    expect(hasPreferredProductIds({})).toBe(false);
  });

  it('hasCustomAttributeSelection returns true only for non-empty custom attribute arrays', () => {
    expect(hasCustomAttributeSelection({attributes: {custom: [{id: 'brand', count: 1}]}})).toBe(true);
    expect(hasCustomAttributeSelection({attributes: {custom: []}})).toBe(false);
    expect(hasCustomAttributeSelection({})).toBe(false);
  });

  it('selection target helpers detect total and master targets', () => {
    expect(hasMasterSelection({master: 1})).toBe(true);
    expect(hasMasterSelection({master: 0})).toBe(false);
    expect(hasAnySelectionTarget({total: 1, master: 0, productIds: []})).toBe(true);
    expect(hasAnySelectionTarget({total: 0, master: 1, productIds: []})).toBe(true);
    expect(hasAnySelectionTarget({total: 0, master: 0, productIds: ['A']})).toBe(true);
    expect(hasAnySelectionTarget({total: 0, master: 0, productIds: []})).toBe(false);
  });

  it('canCaptureFillerDuringPreferredPass is disabled when custom attributes are configured', () => {
    expect(canCaptureFillerDuringPreferredPass({productIds: ['A'], attributes: {custom: []}})).toBe(true);
    expect(canCaptureFillerDuringPreferredPass({master: 1, attributes: {custom: []}})).toBe(true);
    expect(canCaptureFillerDuringPreferredPass({
      productIds: ['A'],
      attributes: {
        custom: [{id: 'brand', count: 1}]
      }
    })).toBe(false);
    expect(canCaptureFillerDuringPreferredPass({total: 1, attributes: {custom: []}})).toBe(false);
  });
});

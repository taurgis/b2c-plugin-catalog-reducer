import {describe, expect, it} from 'vitest';

import {computeCategoryQuotas} from './categoryQuota';

const sumQuotas = (quotas: Map<string, number>): number => [...quotas.values()].reduce((sum, quota) => sum + quota, 0);

describe('computeCategoryQuotas', () => {
  it('returns zero quotas when capacity is zero or negative', () => {
    const buckets = [{key: 'a', size: 10}, {key: 'b', size: 5}];

    expect(computeCategoryQuotas(buckets, 0)).toEqual(new Map([['a', 0], ['b', 0]]));
    expect(computeCategoryQuotas(buckets, -3)).toEqual(new Map([['a', 0], ['b', 0]]));
  });

  it('returns an empty map when there are no buckets', () => {
    expect(computeCategoryQuotas([], 10)).toEqual(new Map());
  });

  it('takes every candidate when the total fits within capacity (no trimming needed)', () => {
    const buckets = [{key: 'a', size: 3}, {key: 'b', size: 2}];
    const quotas = computeCategoryQuotas(buckets, 10);

    expect(quotas).toEqual(new Map([['a', 3], ['b', 2]]));
  });

  it('takes every candidate when the total exactly equals capacity', () => {
    const buckets = [{key: 'a', size: 3}, {key: 'b', size: 2}];
    const quotas = computeCategoryQuotas(buckets, 5);

    expect(quotas).toEqual(new Map([['a', 3], ['b', 2]]));
  });

  it('allocates proportionally to bucket size when trimming is required', () => {
    // 100 candidates total (80/20 split), capacity 10 -> exact proportional split, no remainder.
    const buckets = [{key: 'big', size: 80}, {key: 'small', size: 20}];
    const quotas = computeCategoryQuotas(buckets, 10);

    expect(quotas).toEqual(new Map([['big', 8], ['small', 2]]));
    expect(sumQuotas(quotas)).toBe(10);
  });

  it('never allocates more to a category than it actually has candidates for', () => {
    const buckets = [{key: 'huge', size: 1000}, {key: 'tiny', size: 1}];
    const quotas = computeCategoryQuotas(buckets, 50);

    expect(quotas.get('tiny')).toBeLessThanOrEqual(1);
    expect(quotas.get('huge')!).toBeLessThanOrEqual(1000);
    expect(sumQuotas(quotas)).toBe(50);
  });

  it('distributes rounding remainder smallest-category-first, and the total always equals capacity exactly', () => {
    // 3 categories of size 1 each (3 total candidates), capacity 2: each
    // category's raw share is 2/3 = 0.667, floored to 0 for all three,
    // leaving a remainder of 2 to hand out smallest-first (all tied at
    // size 1, so alphabetical: a, b get the remainder; c does not).
    const buckets = [{key: 'a', size: 1}, {key: 'b', size: 1}, {key: 'c', size: 1}];
    const quotas = computeCategoryQuotas(buckets, 2);

    expect(sumQuotas(quotas)).toBe(2);
    expect(quotas.get('a')).toBe(1);
    expect(quotas.get('b')).toBe(1);
    expect(quotas.get('c')).toBe(0);
  });

  it('is deterministic: the same input always produces the same output', () => {
    const buckets = [{key: 'x', size: 37}, {key: 'y', size: 41}, {key: 'z', size: 5}];

    const first = computeCategoryQuotas(buckets, 23);
    const second = computeCategoryQuotas(buckets.map(bucket => ({...bucket})), 23);

    expect([...first.entries()]).toEqual([...second.entries()]);
  });

  it('degenerates to a single first-come-first-served bucket when there is only one category (the uncategorized fallback case)', () => {
    const buckets = [{key: '__uncategorized__', size: 30}];
    const quotas = computeCategoryQuotas(buckets, 12);

    expect(quotas).toEqual(new Map([['__uncategorized__', 12]]));
  });
});

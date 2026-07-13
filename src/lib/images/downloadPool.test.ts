import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {runWithConcurrency} from './downloadPool';

describe('runWithConcurrency', () => {
  it('resolves immediately with no failures for an empty item list', async () => {
    const worker = async () => {
      throw new Error('should never be called');
    };

    const failures = await runWithConcurrency<number>([], 4, worker);

    expect(failures).toEqual([]);
  });

  it('runs every item and reports no failures when the worker always succeeds', async () => {
    const processed: number[] = [];

    const failures = await runWithConcurrency([1, 2, 3, 4], 2, async item => {
      processed.push(item);
    });

    expect(failures).toEqual([]);
    expect(processed.sort()).toEqual([1, 2, 3, 4]);
  });

  it('continues remaining items after a failure and reports the failed ones', async () => {
    const processed: number[] = [];

    const failures = await runWithConcurrency([1, 2, 3, 4], 2, async item => {
      processed.push(item);

      if (item === 2 || item === 3) {
        throw new Error(`failed on ${item}`);
      }
    });

    expect(processed.sort()).toEqual([1, 2, 3, 4]);
    expect(failures.map(f => f.item).sort()).toEqual([2, 3]);
    expect(failures.every(f => f.error instanceof Error)).toBe(true);
  });

  describe('with a bounded-delay worker', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('never runs more than `concurrency` workers at once', async () => {
      const items = Array.from({length: 10}, (_, i) => i);
      let inFlight = 0;
      let maxInFlight = 0;

      const runPromise = runWithConcurrency(items, 3, async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise<void>(resolve => {
          setTimeout(resolve, 10);
        });
        inFlight -= 1;
      });

      await vi.advanceTimersByTimeAsync(10 * items.length);
      await runPromise;

      expect(maxInFlight).toBe(3);
    });
  });

  it('caps the worker count at the item list length when concurrency is larger', async () => {
    let started = 0;

    await runWithConcurrency([1, 2], 10, async () => {
      started += 1;
    });

    expect(started).toBe(2);
  });
});

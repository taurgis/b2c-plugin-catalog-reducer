export interface PoolFailure<T> {
  item: T;
  error: unknown;
}

export const runWithConcurrency = async <T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<Array<PoolFailure<T>>> => {
  const failures: Array<PoolFailure<T>> = [];

  if (items.length === 0) {
    return failures;
  }

  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  const runWorker = async (): Promise<void> => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;

      try {
        await worker(item);
      } catch (error) {
        failures.push({error, item});
      }
    }
  };

  await Promise.all(Array.from({length: workerCount}, runWorker));

  return failures;
};

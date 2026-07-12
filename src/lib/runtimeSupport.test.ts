import {describe, expect, it} from 'vitest';

import {createSilentRuntime, normalizeRuntimeOptions} from './runtimeSupport';

describe('runtimeSupport', () => {
  describe('normalizeRuntimeOptions flag coercion', () => {
    it('defaults dryRun to false and useCache to true when absent', () => {
      const runtime = normalizeRuntimeOptions({});

      expect(runtime.dryRun).toBe(false);
      expect(runtime.useCache).toBe(true);
    });

    it('accepts real booleans as-is', () => {
      expect(normalizeRuntimeOptions({dryRun: true}).dryRun).toBe(true);
      expect(normalizeRuntimeOptions({dryRun: false}).dryRun).toBe(false);
      expect(normalizeRuntimeOptions({useCache: true}).useCache).toBe(true);
      expect(normalizeRuntimeOptions({useCache: false}).useCache).toBe(false);
    });

    it('recognizes truthy non-boolean values a loose caller might pass for dryRun', () => {
      expect(normalizeRuntimeOptions({dryRun: 1 as any}).dryRun).toBe(true);
      expect(normalizeRuntimeOptions({dryRun: 'true' as any}).dryRun).toBe(true);
      expect(normalizeRuntimeOptions({dryRun: 'TRUE' as any}).dryRun).toBe(true);
    });

    it('recognizes falsy non-boolean values a loose caller might pass for useCache', () => {
      expect(normalizeRuntimeOptions({useCache: 0 as any}).useCache).toBe(false);
      expect(normalizeRuntimeOptions({useCache: 'false' as any}).useCache).toBe(false);
      expect(normalizeRuntimeOptions({useCache: 'FALSE' as any}).useCache).toBe(false);
    });
  });

  describe('createSilentRuntime', () => {
    it('defaults dryRun/useCache and provides no-op logger/progress', () => {
      const runtime = createSilentRuntime();

      expect(runtime.dryRun).toBe(false);
      expect(runtime.useCache).toBe(true);
      expect(() => runtime.logger.info('x')).not.toThrow();
      expect(() => runtime.progress.start(1, 0)).not.toThrow();
    });
  });
});

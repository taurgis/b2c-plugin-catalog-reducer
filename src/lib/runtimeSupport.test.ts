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

    it('recognizes additional common on/off spellings', () => {
      expect(normalizeRuntimeOptions({useCache: 'no' as any}).useCache).toBe(false);
      expect(normalizeRuntimeOptions({useCache: 'off' as any}).useCache).toBe(false);
      expect(normalizeRuntimeOptions({dryRun: 'yes' as any}).dryRun).toBe(true);
      expect(normalizeRuntimeOptions({dryRun: 'on' as any}).dryRun).toBe(true);
    });

    it('falls back to each flag\'s own default when the key is present but undefined', () => {
      // A caller forwarding `{cache: options.cache}` when `options.cache`
      // was never set produces exactly this shape - it must not be
      // coerced to `false` regardless of the flag's default.
      expect(normalizeRuntimeOptions({useCache: undefined}).useCache).toBe(true);
      expect(normalizeRuntimeOptions({dryRun: undefined}).dryRun).toBe(false);
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

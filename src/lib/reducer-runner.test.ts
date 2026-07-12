import {beforeEach, describe, expect, it, vi} from 'vitest';

const runCatalogReduce = vi.fn();

vi.mock('./reduce/runCatalogReduce', () => ({
  runCatalogReduce
}));

describe('runReducer', () => {
  beforeEach(() => {
    runCatalogReduce.mockReset();
  });

  it('forwards options to runCatalogReduce and defaults invocationCwd to process.cwd()', async () => {
    runCatalogReduce.mockResolvedValue({dryRun: false, selectorConfig: {}});
    const {runReducer} = await import('./reducer-runner');

    await runReducer({
      input: 'files/source/puma-catalog.xml',
      output: 'files/filtered/puma-test.xml'
    });

    expect(runCatalogReduce).toHaveBeenCalledWith({
      cache: undefined,
      config: undefined,
      dryRun: undefined,
      input: 'files/source/puma-catalog.xml',
      invocationCwd: process.cwd(),
      output: 'files/filtered/puma-test.xml'
    });
  });

  it('forwards an explicit invocationCwd, config, dryRun, and cache through unchanged', async () => {
    runCatalogReduce.mockResolvedValue({dryRun: true, selectorConfig: {}});
    const {runReducer} = await import('./reducer-runner');
    const invocationCwd = '/some/invocation/cwd';

    await runReducer({
      cache: false,
      config: 'configs/local.json',
      dryRun: true,
      input: 'catalog.xml',
      invocationCwd,
      output: 'catalog-reduced.xml'
    });

    expect(runCatalogReduce).toHaveBeenCalledWith({
      cache: false,
      config: 'configs/local.json',
      dryRun: true,
      input: 'catalog.xml',
      invocationCwd,
      output: 'catalog-reduced.xml'
    });
  });

  it('resolves 0 on success', async () => {
    runCatalogReduce.mockResolvedValue({dryRun: false, selectorConfig: {}});
    const {runReducer} = await import('./reducer-runner');

    await expect(runReducer({
      input: '/tmp/input.xml',
      output: '/tmp/output.xml'
    })).resolves.toBe(0);
  });

  it('propagates a rejection from runCatalogReduce', async () => {
    runCatalogReduce.mockRejectedValue(new Error('boom'));
    const {runReducer} = await import('./reducer-runner');

    await expect(runReducer({
      input: '/tmp/input.xml',
      output: '/tmp/output.xml'
    })).rejects.toThrow(/boom/);
  });
});

import {beforeEach, describe, expect, it, vi} from 'vitest';

const runReducer = vi.fn();

vi.mock('../../lib/reducer-runner', () => ({
  runReducer
}));

describe('catalog reduce command', () => {
  beforeEach(() => {
    runReducer.mockReset();
  });

  it('passes reducer flags through to the wrapper', async () => {
    runReducer.mockResolvedValue(0);
    const {default: CatalogReduce} = await import('./reduce');

    await CatalogReduce.run([
      '--input',
      'files/source/puma-catalog.xml',
      '--output',
      'files/filtered/puma-test.xml'
    ]);

    expect(runReducer).toHaveBeenCalledWith({
      config: undefined,
      input: 'files/source/puma-catalog.xml',
      invocationCwd: process.cwd(),
      output: 'files/filtered/puma-test.xml'
    });
  });

  it('passes config file paths through to the wrapper', async () => {
    runReducer.mockResolvedValue(0);
    const {default: CatalogReduce} = await import('./reduce');

    await CatalogReduce.run([
      '--input',
      'catalog.xml',
      '--output',
      'catalog-reduced.xml',
      '--config',
      'configs/catalog-reducer.json'
    ]);

    expect(runReducer).toHaveBeenCalledWith({
      config: 'configs/catalog-reducer.json',
      input: 'catalog.xml',
      invocationCwd: process.cwd(),
      output: 'catalog-reduced.xml'
    });
  });

  it('rejects the removed project flag', async () => {
    const {default: CatalogReduce} = await import('./reduce');

    await expect(
      CatalogReduce.run([
        '--input',
        'catalog.xml',
        '--output',
        'catalog-reduced.xml',
        '--project',
        'test'
      ])
    ).rejects.toThrow(/project|Nonexistent flag/);
  });

  it('surfaces wrapper failures as command errors', async () => {
    runReducer.mockRejectedValue(new Error('boom'));
    const {default: CatalogReduce} = await import('./reduce');

    await expect(
      CatalogReduce.run([
        '--input',
        'files/source/puma-catalog.xml',
        '--output',
        'files/filtered/puma-test.xml'
      ])
    ).rejects.toThrow(/boom/);
  });
});
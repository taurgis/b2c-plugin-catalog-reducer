import path from 'node:path';

import {beforeEach, describe, expect, it, vi} from 'vitest';

const detectCatalogStructure = vi.fn();
const buildScaffoldedConfig = vi.fn();
const writeScaffoldedConfig = vi.fn();

vi.mock('../../lib/catalogInit', () => ({
  detectCatalogStructure,
  buildScaffoldedConfig,
  writeScaffoldedConfig
}));

describe('catalog init command (non-interactive / --yes)', () => {
  beforeEach(() => {
    detectCatalogStructure.mockReset();
    buildScaffoldedConfig.mockReset();
    writeScaffoldedConfig.mockReset();
  });

  it('scaffolds a config from an unambiguously-detected catalog file', async () => {
    detectCatalogStructure.mockResolvedValue({
      catalogFile: '/scan/dir/puma-catalog.xml',
      pricebookFiles: ['/scan/dir/puma-pricebook.xml'],
      storefrontFiles: [],
      ambiguousCatalogCandidates: []
    });
    buildScaffoldedConfig.mockReturnValue({total: 1000, master: 0});
    writeScaffoldedConfig.mockResolvedValue(undefined);

    const {default: CatalogInit} = await import('./init');

    await CatalogInit.run(['--dir', '/scan/dir', '--output', '/scan/dir/out.json', '--yes']);

    expect(detectCatalogStructure).toHaveBeenCalledWith('/scan/dir');
    expect(buildScaffoldedConfig).toHaveBeenCalledWith({
      total: 1000,
      master: 0,
      onlineSiteIds: [],
      pricebookSourceFiles: ['/scan/dir/puma-pricebook.xml'],
      storefrontSourceFiles: []
    });
    expect(writeScaffoldedConfig).toHaveBeenCalledWith('/scan/dir/out.json', {total: 1000, master: 0}, false);
  });

  it('uses explicit --total/--master overrides instead of the --yes defaults', async () => {
    detectCatalogStructure.mockResolvedValue({
      catalogFile: '/scan/dir/puma-catalog.xml',
      pricebookFiles: [],
      storefrontFiles: [],
      ambiguousCatalogCandidates: []
    });
    buildScaffoldedConfig.mockReturnValue({});
    writeScaffoldedConfig.mockResolvedValue(undefined);

    const {default: CatalogInit} = await import('./init');

    await CatalogInit.run(['--dir', '/scan/dir', '--yes', '--total', '5000', '--master', '200']);

    expect(buildScaffoldedConfig).toHaveBeenCalledWith(expect.objectContaining({total: 5000, master: 200}));
  });

  it('respects an explicit --catalog override even when detection is ambiguous', async () => {
    detectCatalogStructure.mockResolvedValue({
      catalogFile: null,
      pricebookFiles: [],
      storefrontFiles: [],
      ambiguousCatalogCandidates: [path.join('/scan/dir', 'a-catalog.xml'), path.join('/scan/dir', 'b-catalog.xml')]
    });
    buildScaffoldedConfig.mockReturnValue({});
    writeScaffoldedConfig.mockResolvedValue(undefined);

    const {default: CatalogInit} = await import('./init');

    await CatalogInit.run(['--dir', '/scan/dir', '--yes', '--catalog', '/scan/dir/a-catalog.xml']);

    expect(writeScaffoldedConfig).toHaveBeenCalled();
  });

  it('fails with an actionable error when detection is ambiguous, --yes is set, and no --catalog override is given', async () => {
    detectCatalogStructure.mockResolvedValue({
      catalogFile: null,
      pricebookFiles: [],
      storefrontFiles: [],
      ambiguousCatalogCandidates: ['/scan/dir/a-catalog.xml', '/scan/dir/b-catalog.xml']
    });

    const {default: CatalogInit} = await import('./init');

    await expect(CatalogInit.run(['--dir', '/scan/dir', '--yes'])).rejects.toThrow(/Multiple candidate catalog files/);
    expect(writeScaffoldedConfig).not.toHaveBeenCalled();
  });

  it('fails with an actionable error when no catalog file is detected at all, --yes is set, and no --catalog override is given', async () => {
    detectCatalogStructure.mockResolvedValue({
      catalogFile: null,
      pricebookFiles: [],
      storefrontFiles: [],
      ambiguousCatalogCandidates: []
    });

    const {default: CatalogInit} = await import('./init');

    await expect(CatalogInit.run(['--dir', '/scan/dir', '--yes'])).rejects.toThrow(/No catalog XML file found/);
    expect(writeScaffoldedConfig).not.toHaveBeenCalled();
  });

  it('surfaces write failures (e.g. existing file without --force) as command errors', async () => {
    detectCatalogStructure.mockResolvedValue({
      catalogFile: '/scan/dir/puma-catalog.xml',
      pricebookFiles: [],
      storefrontFiles: [],
      ambiguousCatalogCandidates: []
    });
    buildScaffoldedConfig.mockReturnValue({});
    writeScaffoldedConfig.mockRejectedValue(new Error('Config file already exists at /scan/dir/out.json. Re-run with --force to overwrite.'));

    const {default: CatalogInit} = await import('./init');

    await expect(CatalogInit.run(['--dir', '/scan/dir', '--output', '/scan/dir/out.json', '--yes'])).rejects.toThrow(/already exists/);
  });

  it('passes --force through to writeScaffoldedConfig', async () => {
    detectCatalogStructure.mockResolvedValue({
      catalogFile: '/scan/dir/puma-catalog.xml',
      pricebookFiles: [],
      storefrontFiles: [],
      ambiguousCatalogCandidates: []
    });
    buildScaffoldedConfig.mockReturnValue({});
    writeScaffoldedConfig.mockResolvedValue(undefined);

    const {default: CatalogInit} = await import('./init');

    await CatalogInit.run(['--dir', '/scan/dir', '--output', '/scan/dir/out.json', '--yes', '--force']);

    expect(writeScaffoldedConfig).toHaveBeenCalledWith('/scan/dir/out.json', {}, true);
  });

  it('passes repeated --site-id flags through as onlineSiteIds', async () => {
    detectCatalogStructure.mockResolvedValue({
      catalogFile: '/scan/dir/puma-catalog.xml',
      pricebookFiles: [],
      storefrontFiles: [],
      ambiguousCatalogCandidates: []
    });
    buildScaffoldedConfig.mockReturnValue({});
    writeScaffoldedConfig.mockResolvedValue(undefined);

    const {default: CatalogInit} = await import('./init');

    await CatalogInit.run(['--dir', '/scan/dir', '--yes', '--site-id', 'MX', '--site-id', 'US']);

    expect(buildScaffoldedConfig).toHaveBeenCalledWith(expect.objectContaining({onlineSiteIds: ['MX', 'US']}));
  });
});

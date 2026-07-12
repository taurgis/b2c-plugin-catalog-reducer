import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it} from 'vitest';

import {buildScaffoldedConfig, detectCatalogStructure, writeScaffoldedConfig} from './catalogInit';

describe('catalogInit', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, {recursive: true, force: true})));
  });

  const mkTempDir = async (): Promise<string> => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-init-'));
    tempDirs.push(tempDir);
    return tempDir;
  };

  const touch = async (dir: string, name: string): Promise<void> => {
    await fs.writeFile(path.join(dir, name), '<catalog/>', 'utf8');
  };

  describe('detectCatalogStructure', () => {
    it('auto-selects a single unambiguous catalog file and classifies pricebook/storefront siblings', async () => {
      const dir = await mkTempDir();

      await touch(dir, 'puma-catalog.xml');
      await touch(dir, 'puma-list-pricebook.xml');
      await touch(dir, 'puma-sale-pricebook.xml');
      await touch(dir, 'puma-storefront-catalog.xml');
      await touch(dir, 'README.md');

      const detected = await detectCatalogStructure(dir);

      expect(detected.catalogFile).toBe(path.join(dir, 'puma-catalog.xml'));
      expect(detected.ambiguousCatalogCandidates).toEqual([]);
      expect(detected.pricebookFiles).toEqual([
        path.join(dir, 'puma-list-pricebook.xml'),
        path.join(dir, 'puma-sale-pricebook.xml')
      ]);
      expect(detected.storefrontFiles).toEqual([path.join(dir, 'puma-storefront-catalog.xml')]);
    });

    it('excludes inventory files from every classification bucket', async () => {
      const dir = await mkTempDir();

      await touch(dir, 'puma-catalog.xml');
      await touch(dir, 'puma-inventory.xml');

      const detected = await detectCatalogStructure(dir);

      expect(detected.catalogFile).toBe(path.join(dir, 'puma-catalog.xml'));
      expect(detected.pricebookFiles).toEqual([]);
      expect(detected.storefrontFiles).toEqual([]);
    });

    it('reports ambiguity when zero catalog candidates are found', async () => {
      const dir = await mkTempDir();

      await touch(dir, 'puma-pricebook.xml');

      const detected = await detectCatalogStructure(dir);

      expect(detected.catalogFile).toBeNull();
      expect(detected.ambiguousCatalogCandidates).toEqual([]);
    });

    it('reports ambiguity when multiple catalog candidates are found', async () => {
      const dir = await mkTempDir();

      await touch(dir, 'master-catalog.xml');
      await touch(dir, 'other-catalog.xml');

      const detected = await detectCatalogStructure(dir);

      expect(detected.catalogFile).toBeNull();
      expect(detected.ambiguousCatalogCandidates).toEqual([
        path.join(dir, 'master-catalog.xml'),
        path.join(dir, 'other-catalog.xml')
      ]);
    });

    it('returns an empty, unambiguous-free result for an empty directory', async () => {
      const dir = await mkTempDir();

      const detected = await detectCatalogStructure(dir);

      expect(detected).toEqual({
        catalogFile: null,
        pricebookFiles: [],
        storefrontFiles: [],
        ambiguousCatalogCandidates: []
      });
    });
  });

  describe('buildScaffoldedConfig', () => {
    it('builds the canonical flat config shape', () => {
      const config = buildScaffoldedConfig({
        total: 1000,
        master: 100,
        onlineSiteIds: ['MX'],
        pricebookSourceFiles: ['/a/pricebook.xml'],
        storefrontSourceFiles: ['/a/storefront.xml']
      });

      expect(config).toEqual({
        total: 1000,
        master: 100,
        productIds: [],
        attributes: {custom: []},
        onlineSiteIds: ['MX'],
        pricebookRandomSeed: null,
        pricebookSourceFiles: ['/a/pricebook.xml'],
        storefrontSourceFiles: ['/a/storefront.xml']
      });
    });
  });

  describe('writeScaffoldedConfig', () => {
    it('writes the config as formatted JSON', async () => {
      const dir = await mkTempDir();
      const outputPath = path.join(dir, 'catalog-reducer.json');

      await writeScaffoldedConfig(outputPath, {total: 5}, false);

      const written = JSON.parse(await fs.readFile(outputPath, 'utf8'));

      expect(written).toEqual({total: 5});
    });

    it('refuses to overwrite an existing file without --force', async () => {
      const dir = await mkTempDir();
      const outputPath = path.join(dir, 'catalog-reducer.json');

      await writeScaffoldedConfig(outputPath, {total: 5}, false);

      await expect(writeScaffoldedConfig(outputPath, {total: 10}, false)).rejects.toThrow(/already exists/);
    });

    it('overwrites an existing file when force is true', async () => {
      const dir = await mkTempDir();
      const outputPath = path.join(dir, 'catalog-reducer.json');

      await writeScaffoldedConfig(outputPath, {total: 5}, false);
      await writeScaffoldedConfig(outputPath, {total: 10}, true);

      const written = JSON.parse(await fs.readFile(outputPath, 'utf8'));

      expect(written).toEqual({total: 10});
    });
  });
});

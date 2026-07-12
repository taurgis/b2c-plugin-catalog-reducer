import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it} from 'vitest';

import {DEFAULT_SELECTOR_CONFIG, loadConfigFile, resolveConfigPath} from './selectorConfig';

describe('selectorConfig', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, {recursive: true, force: true})));
  });

  const mkTempDir = async (): Promise<string> => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-selector-config-'));
    tempDirs.push(tempDir);
    return tempDir;
  };

  it('resolveConfigPath returns absolute paths unchanged', () => {
    expect(resolveConfigPath('/abs/config.json', '/some/cwd')).toBe('/abs/config.json');
  });

  it('resolveConfigPath resolves relative paths against invocationCwd', () => {
    expect(resolveConfigPath('config.json', '/some/cwd')).toBe(path.resolve('/some/cwd', 'config.json'));
  });

  it('loadConfigFile merges a partial config over DEFAULT_SELECTOR_CONFIG', async () => {
    const tempDir = await mkTempDir();
    const configPath = path.join(tempDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify({total: 10, master: 2}), 'utf8');

    const config = await loadConfigFile(configPath);

    expect(config.total).toBe(10);
    expect(config.master).toBe(2);
    expect(config.productIds).toEqual(DEFAULT_SELECTOR_CONFIG.productIds);
    expect(config.attributes).toEqual(DEFAULT_SELECTOR_CONFIG.attributes);
    expect(config.onlineSiteIds).toEqual(DEFAULT_SELECTOR_CONFIG.onlineSiteIds);
  });

  it('loadConfigFile merges attributes.custom rather than overwriting the whole attributes object', async () => {
    const tempDir = await mkTempDir();
    const configPath = path.join(tempDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify({attributes: {custom: [{id: 'brand', count: 1}]}}), 'utf8');

    const config = await loadConfigFile(configPath);

    expect(config.attributes).toEqual({custom: [{id: 'brand', count: 1}]});
  });

  it('loadConfigFile resolves relative pricebookSourceFiles and storefrontSourceFiles against the config file directory', async () => {
    const tempDir = await mkTempDir();
    const configPath = path.join(tempDir, 'nested', 'config.json');
    await fs.mkdir(path.dirname(configPath), {recursive: true});
    await fs.writeFile(configPath, JSON.stringify({
      pricebookSourceFiles: ['../files/list.xml', '/absolute/sale.xml'],
      storefrontSourceFiles: ['../files/storefront.xml']
    }), 'utf8');

    const config = await loadConfigFile(configPath);

    expect(config.pricebookSourceFiles).toEqual([
      path.resolve(path.dirname(configPath), '../files/list.xml'),
      '/absolute/sale.xml'
    ]);
    expect(config.storefrontSourceFiles).toEqual([
      path.resolve(path.dirname(configPath), '../files/storefront.xml')
    ]);
  });

  it('loadConfigFile resolves a relative config path against invocationCwd', async () => {
    const tempDir = await mkTempDir();
    await fs.writeFile(path.join(tempDir, 'config.json'), JSON.stringify({total: 3}), 'utf8');

    const config = await loadConfigFile('config.json', tempDir);

    expect(config.total).toBe(3);
  });

  it('loadConfigFile rejects when the config file does not exist', async () => {
    await expect(loadConfigFile('/nonexistent/config.json')).rejects.toThrow();
  });

  it('loadConfigFile accepts the friendly nested config shape and converts it to canonical fields', async () => {
    const tempDir = await mkTempDir();
    const configPath = path.join(tempDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify({
      $schema: 'catalog-reducer-config@1',
      selection: {totalProducts: 20, masterProducts: 5, productIds: ['A1']},
      sites: {onlineSiteIds: ['MX']}
    }), 'utf8');

    const config = await loadConfigFile(configPath);

    expect(config.total).toBe(20);
    expect(config.master).toBe(5);
    expect(config.productIds).toEqual(['A1']);
    expect(config.onlineSiteIds).toEqual(['MX']);
    // Fields not present in the friendly config still fall back to defaults.
    expect(config.attributes).toEqual(DEFAULT_SELECTOR_CONFIG.attributes);
  });

  it('loadConfigFile rejects a friendly-shape config with an unrecognized $schema', async () => {
    const tempDir = await mkTempDir();
    const configPath = path.join(tempDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify({$schema: 'not-a-real-schema', selection: {totalProducts: 20}}), 'utf8');

    await expect(loadConfigFile(configPath)).rejects.toThrow(/Unsupported config \$schema/);
  });

  it('every existing config/*.json fixture uses the canonical shape (no $schema key), so friendly-shape conversion never runs for them', async () => {
    const configDir = path.resolve(__dirname, '../../config');
    // friendly-example.json is intentionally an example of the *other*
    // shape (see README.md's Friendly Config Shape section) - excluded here
    // since this test guards against existing canonical fixtures drifting,
    // not against the example that documents the new shape.
    const fixtureNames = (await fs.readdir(configDir)).filter(name => name.endsWith('.json') && name !== 'friendly-example.json');

    expect(fixtureNames.length).toBeGreaterThan(0);

    for (const fixtureName of fixtureNames) {
      const raw = await fs.readFile(path.join(configDir, fixtureName), 'utf8');
      expect(JSON.parse(raw)).not.toHaveProperty('$schema');
    }
  });
});

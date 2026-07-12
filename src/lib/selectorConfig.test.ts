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
});

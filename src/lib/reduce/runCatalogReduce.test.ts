import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it} from 'vitest';

import {runCatalogReduce} from './runCatalogReduce';

const buildCatalogXml = (catalogId: string, productId: string): string => {
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + `<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="${catalogId}">\n`
    + `  <product product-id="${productId}">\n`
    + '    <online-flag>true</online-flag>\n'
    + '    <images><image-group view-type="large"><image path="images/test.jpg"/></image-group></images>\n'
    + '  </product>\n'
    + '</catalog>\n';
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const createRecordingLogger = () => {
  const info: unknown[][] = [];
  const warn: unknown[][] = [];
  const error: unknown[][] = [];

  return {
    logger: {
      info: (...args: unknown[]) => info.push(args),
      warn: (...args: unknown[]) => warn.push(args),
      error: (...args: unknown[]) => error.push(args)
    },
    info,
    warn,
    error
  };
};

describe('runCatalogReduce', () => {
  const tempDirs: string[] = [];

  const mkTempDir = async (): Promise<string> => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-run-catalog-reduce-'));
    tempDirs.push(tempDir);
    return tempDir;
  };

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, {recursive: true, force: true})));
  });

  it('runs end to end with the default config (no --config) and validates XSD', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'input.xml');
    const outputFilename = path.join(tempDir, 'output.xml');
    await fs.writeFile(inputFilename, buildCatalogXml('default-config-catalog', 'DEFAULT-1'), 'utf8');

    const {logger} = createRecordingLogger();
    const result = await runCatalogReduce({
      input: inputFilename,
      output: outputFilename,
      logger,
      cache: false
    });

    expect(result.dryRun).toBe(false);
    // Default config has total: 0, so nothing is selected, but the full
    // write + XSD validation pipeline still runs and must succeed.
    expect(await fileExists(outputFilename)).toBe(true);
    expect(await fileExists(path.join(tempDir, 'output-inventory.xml'))).toBe(true);
    expect(await fileExists(path.join(tempDir, 'output-pricebook.xml'))).toBe(true);
  });

  it('loads an explicit --config file, selects products, and writes valid output', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'input.xml');
    const outputFilename = path.join(tempDir, 'output.xml');
    const configFilename = path.join(tempDir, 'config.json');

    await fs.writeFile(inputFilename, buildCatalogXml('config-catalog', 'CFG-1'), 'utf8');
    await fs.writeFile(configFilename, JSON.stringify({
      total: 1,
      master: 0,
      productIds: [],
      attributes: {custom: []},
      beautify: false
    }), 'utf8');

    const result = await runCatalogReduce({
      input: inputFilename,
      output: outputFilename,
      config: configFilename,
      cache: false
    });

    expect(result.dryRun).toBe(false);
    expect(result.selectorConfig.total).toBe(1);

    const catalogOutput = await fs.readFile(outputFilename, 'utf8');
    expect(catalogOutput).toMatch(/product-id="CFG-1"/);
  });

  it('resolves relative input/output/config paths against invocationCwd', async () => {
    const tempDir = await mkTempDir();
    await fs.writeFile(path.join(tempDir, 'input.xml'), buildCatalogXml('relative-catalog', 'REL-1'), 'utf8');
    await fs.writeFile(path.join(tempDir, 'config.json'), JSON.stringify({total: 1}), 'utf8');

    await runCatalogReduce({
      input: 'input.xml',
      output: 'output.xml',
      config: 'config.json',
      invocationCwd: tempDir,
      cache: false
    });

    expect(await fileExists(path.join(tempDir, 'output.xml'))).toBe(true);
  });

  it('in dry-run mode writes no files and skips XSD validation', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'input.xml');
    const outputFilename = path.join(tempDir, 'output.xml');
    await fs.writeFile(inputFilename, buildCatalogXml('dry-run-catalog', 'DRY-1'), 'utf8');

    const {logger, info} = createRecordingLogger();
    const result = await runCatalogReduce({
      input: inputFilename,
      output: outputFilename,
      dryRun: true,
      cache: false,
      logger
    });

    expect(result.dryRun).toBe(true);
    expect(await fileExists(outputFilename)).toBe(false);
    expect(info.some(args => /Dry run complete/.test(String(args[0])))).toBe(true);
    expect(info.some(args => /Validating generated XML/.test(String(args[0])))).toBe(false);
  });

  it('rejects on an invalid input file without ever calling process.exit (throws instead)', async () => {
    const tempDir = await mkTempDir();
    const inputFilename = path.join(tempDir, 'input.xml');
    const outputFilename = path.join(tempDir, 'output.xml');
    await fs.writeFile(inputFilename, '<?xml version="1.0"?><not-a-catalog/>', 'utf8');

    await expect(runCatalogReduce({
      input: inputFilename,
      output: outputFilename,
      cache: false
    })).rejects.toThrow(/catalog-id/i);
  });

  it('can be invoked twice sequentially in the same process with different options and no cross-invocation leakage', async () => {
    const tempDirA = await mkTempDir();
    const tempDirB = await mkTempDir();
    const inputA = path.join(tempDirA, 'input.xml');
    const outputA = path.join(tempDirA, 'output.xml');
    const inputB = path.join(tempDirB, 'input.xml');
    const outputB = path.join(tempDirB, 'output.xml');

    await fs.writeFile(inputA, buildCatalogXml('catalog-a', 'A-PRODUCT'), 'utf8');
    await fs.writeFile(inputB, buildCatalogXml('catalog-b', 'B-PRODUCT'), 'utf8');

    // First invocation: dry-run, config A.
    const firstResult = await runCatalogReduce({
      input: inputA,
      output: outputA,
      dryRun: true,
      cache: false
    });

    // Second invocation, immediately after, in the same process: a real
    // (non-dry-run) run against a completely different input/output pair.
    const secondResult = await runCatalogReduce({
      input: inputB,
      output: outputB,
      cache: false
    });

    // Re-run the first invocation's exact options again - if any module-level
    // state leaked from the second call, this would behave differently.
    const thirdResult = await runCatalogReduce({
      input: inputA,
      output: outputA,
      dryRun: true,
      cache: false
    });

    expect(firstResult.dryRun).toBe(true);
    expect(await fileExists(outputA)).toBe(false);

    expect(secondResult.dryRun).toBe(false);
    expect(await fileExists(outputB)).toBe(true);
    const catalogBOutput = await fs.readFile(outputB, 'utf8');
    expect(catalogBOutput).toMatch(/catalog-id="catalog-b"/);

    expect(thirdResult.dryRun).toBe(true);
    expect(await fileExists(outputA)).toBe(false);
  });
});

// Writes the reduced pricebook XML output(s): either a single generated
// pricebook with randomized amounts, or one filtered pricebook per
// configured `pricebookSourceFiles` entry. Split out of the legacy
// monolithic lib/parser.js.
import '../vendor-shims';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

import flow from 'xml-flow';

import {Logger, SelectorConfig, XmlNode} from '../types';
import {
  buildSelectedProductIdSet,
  deriveNamedOutputFilename,
  deriveOutputFilename,
  escapeXmlAttribute,
  getConfiguredSourceFiles,
  PRICEBOOK_ID,
  PRICEBOOK_XML_NAMESPACE,
  removeFileIfExists,
  serializeXml,
  toArray,
  writeXmlChunks,
  XML_HEADER
} from './xmlSerialization';

const getConfiguredPricebookSourceFiles = (selectorConfig: SelectorConfig): string[] => getConfiguredSourceFiles(selectorConfig, 'pricebookSourceFiles');

const normalizeSeed = (seedValue: unknown): number => {
  const maxSeed = 2147483647;
  const numericSeed = Number(seedValue);

  if (Number.isFinite(numericSeed)) {
    const normalizedNumericSeed = Math.abs(Math.trunc(numericSeed)) % maxSeed;

    return normalizedNumericSeed || 1;
  }

  const seedText = String(seedValue);
  let hashedSeed = 0;

  for (let i = 0; i < seedText.length; i++) {
    hashedSeed = ((hashedSeed * 31) + seedText.charCodeAt(i)) % maxSeed;
  }

  return hashedSeed || 1;
};

const createSeededRandomGenerator = (seedValue: unknown): (() => number) => {
  const maxSeed = 2147483647;
  let seed = normalizeSeed(seedValue);

  return () => {
    seed = (seed * 48271) % maxSeed;

    return (seed - 1) / (maxSeed - 1);
  };
};

const createPricebookAmountGenerator = (selectorConfig: SelectorConfig | null): (() => string) => {
  const seed = selectorConfig ? selectorConfig.pricebookRandomSeed : undefined;

  if (seed === null || seed === undefined || seed === '') {
    // Price amounts are intentionally randomized to create representative sample pricebooks.
    return () => ((Math.random() * 100) + 1).toFixed(2);
  }

  const seededRandom = createSeededRandomGenerator(seed);

  return () => ((seededRandom() * 100) + 1).toFixed(2);
};

const buildCompactPricebookChunks = function* (productSelection: XmlNode[], generatePricebookAmount: () => string): Generator<string> {
  yield XML_HEADER;
  yield `<pricebooks xmlns="${PRICEBOOK_XML_NAMESPACE}"><pricebook><header pricebook-id="${PRICEBOOK_ID}">`;
  yield '<currency>EUR</currency>';
  yield `<display-name>${PRICEBOOK_ID}</display-name>`;
  yield '<online-flag>true</online-flag></header><price-tables>';

  for (let i = 0; i < productSelection.length; i++) {
    const productId = productSelection[i].$attrs['product-id'];
    const escapedProductId = escapeXmlAttribute(productId);
    const amount = generatePricebookAmount();

    yield `<price-table product-id="${escapedProductId}"><amount quantity="1">${amount}</amount></price-table>`;
  }

  yield '</price-tables></pricebook></pricebooks>';
};

const buildPricebook = (productSelection: XmlNode[], generatePricebookAmount: () => string): XmlNode => {
  const pricebook: XmlNode = {
    $name: 'pricebooks',
    $attrs: {
      xmlns: PRICEBOOK_XML_NAMESPACE
    },
    pricebook: {
      header: {
        $attrs: {
          'pricebook-id': PRICEBOOK_ID
        },
        currency: 'EUR',
        'display-name': PRICEBOOK_ID,
        'online-flag': 'true'
      },
      'price-tables': {
        'price-table': [] as XmlNode[]
      }
    }
  };

  for (let i = 0; i < productSelection.length; i++) {
    const productId = productSelection[i].$attrs['product-id'];

    pricebook.pricebook['price-tables']['price-table'].push({
      $attrs: {
        'product-id': productId
      },
      amount: {
        $attrs: {
          quantity: 1
        },
        $text: generatePricebookAmount()
      }
    });
  }

  return pricebook;
};

const extractPriceTables = (pricebook: XmlNode): XmlNode[] => {
  const priceTablesNode = pricebook['price-tables'];

  if (!priceTablesNode) {
    return [];
  }

  if (Array.isArray(priceTablesNode)) {
    return priceTablesNode;
  }

  if (Array.isArray(priceTablesNode['price-table'])) {
    return priceTablesNode['price-table'];
  }

  if (priceTablesNode['price-table']) {
    return [priceTablesNode['price-table']];
  }

  if (priceTablesNode.$attrs && priceTablesNode.$attrs['product-id']) {
    return [priceTablesNode];
  }

  return [];
};

const filterPricebookTablesBySelectedProductIds = (pricebook: XmlNode, selectedProductIds: Set<string>): XmlNode => {
  const priceTables = extractPriceTables(pricebook);

  if (priceTables.length === 0) {
    return pricebook;
  }

  const filteredPriceTables = toArray(priceTables).filter(priceTable => {
    const productId = priceTable && priceTable.$attrs ? priceTable.$attrs['product-id'] : null;

    return productId && selectedProductIds.has(productId);
  });

  if (filteredPriceTables.length === 0) {
    delete pricebook['price-tables'];
    return pricebook;
  }

  pricebook['price-tables'] = {
    'price-table': filteredPriceTables
  };

  return pricebook;
};

const iterateSourcePricebooks = async function* (sourceFilePath: string): AsyncGenerator<XmlNode> {
  const stream = fs.createReadStream(sourceFilePath, {encoding: 'utf8'});
  const sourceParser = flow(stream);
  const queue: XmlNode[] = [];
  let settled = false;
  let pendingResolve: (() => void) | null = null;
  let pendingError: Error | null = null;

  const wake = () => {
    if (typeof pendingResolve === 'function') {
      const resolve = pendingResolve;

      pendingResolve = null;
      resolve();
    }
  };

  const finish = (error?: Error) => {
    if (settled) {
      return;
    }

    settled = true;
    pendingError = error || null;
    wake();
  };

  stream.on('error', error => {
    finish(new Error(`Unable to read configured pricebook source file "${sourceFilePath}": ${error.message}`));
  });

  sourceParser.on('error', error => {
    finish(new Error(`Unable to parse configured pricebook source file "${sourceFilePath}": ${error.message}`));
  });

  sourceParser.on('tag:pricebook', pricebook => {
    queue.push(pricebook);

    if (!settled && !stream.destroyed) {
      stream.pause();
    }

    wake();
  });

  sourceParser.on('end', () => {
    finish();
  });

  try {
    while (!settled || queue.length) {
      if (!queue.length) {
        await new Promise<void>(resolve => {
          pendingResolve = resolve;
        });
      }

      if (pendingError) {
        throw pendingError;
      }

      while (queue.length) {
        const pricebook = queue.shift()!;

        yield pricebook;

        if (!settled && !stream.destroyed && stream.isPaused()) {
          stream.resume();
        }
      }
    }
  } finally {
    if (!stream.destroyed) {
      stream.destroy();
    }

    sourceParser.removeAllListeners('error');
    sourceParser.removeAllListeners('tag:pricebook');
    sourceParser.removeAllListeners('end');
  }
};

const collectFilteredPricebooksFromSourceFile = async (sourceFilePath: string, selectedProductIds: Set<string>): Promise<XmlNode[]> => {
  const filteredPricebooks: XmlNode[] = [];

  for await (const pricebook of iterateSourcePricebooks(sourceFilePath)) {
    filteredPricebooks.push(filterPricebookTablesBySelectedProductIds(pricebook, selectedProductIds));
  }

  return filteredPricebooks;
};

const buildCompactSourcePricebookChunks = async function* (sourceFilePath: string, selectedProductIds: Set<string>): AsyncGenerator<string> {
  yield XML_HEADER;
  yield `<pricebooks xmlns="${PRICEBOOK_XML_NAMESPACE}">`;

  for await (const pricebook of iterateSourcePricebooks(sourceFilePath)) {
    yield flow.toXml({
      pricebook: filterPricebookTablesBySelectedProductIds(pricebook, selectedProductIds)
    });
  }

  yield '</pricebooks>';
};

const buildPricebookSelection = (pricebooks: XmlNode[]): XmlNode => {
  const selection: XmlNode = {
    $name: 'pricebooks',
    $attrs: {
      xmlns: PRICEBOOK_XML_NAMESPACE
    }
  };

  if (pricebooks.length > 0) {
    selection.pricebook = pricebooks;
  }

  return selection;
};

const buildPricebookOutputsFromSourceFiles = async (
  outputFilename: string,
  selectorConfig: SelectorConfig
): Promise<Array<{outputFilename: string; sourceFilePath: string}>> => {
  const sourceFiles = getConfiguredPricebookSourceFiles(selectorConfig);

  if (sourceFiles.length === 0) {
    return [];
  }

  const sourceNameCounts = new Map<string, number>();
  const outputSelections: Array<{outputFilename: string; sourceFilePath: string}> = [];

  for (let i = 0; i < sourceFiles.length; i++) {
    const sourceFilePath = path.resolve(process.cwd(), sourceFiles[i]);

    try {
      await fsPromises.access(sourceFilePath, fs.constants.R_OK);
    } catch {
      throw new Error(`Configured pricebook source file "${sourceFiles[i]}" is not readable.`);
    }

    outputSelections.push({
      outputFilename: deriveNamedOutputFilename(outputFilename, sourceFiles[i], sourceNameCounts, '-', 'pricebook'),
      sourceFilePath
    });
  }

  return outputSelections;
};

export const writePricebookXml = async (
  outputFilename: string,
  productSelection: XmlNode[],
  selectorConfig: SelectorConfig,
  beautifyOutput: boolean,
  logger: Logger
): Promise<void> => {
  const sourcePricebookOutputs = await buildPricebookOutputsFromSourceFiles(outputFilename, selectorConfig);
  const defaultPricebookOutputFilename = deriveOutputFilename(outputFilename, '-pricebook');

  if (sourcePricebookOutputs.length > 0) {
    const selectedProductIds = buildSelectedProductIdSet(productSelection);

    await removeFileIfExists(defaultPricebookOutputFilename);

    await Promise.all(sourcePricebookOutputs.map(async sourcePricebookOutput => {
      if (!beautifyOutput) {
        await writeXmlChunks(
          sourcePricebookOutput.outputFilename,
          buildCompactSourcePricebookChunks(sourcePricebookOutput.sourceFilePath, selectedProductIds)
        );
        return;
      }

      const filteredPricebooks = await collectFilteredPricebooksFromSourceFile(
        sourcePricebookOutput.sourceFilePath,
        selectedProductIds
      );
      const sourcePricebookXml = await serializeXml(
        buildPricebookSelection(filteredPricebooks),
        beautifyOutput,
        logger
      );

      await fsPromises.writeFile(sourcePricebookOutput.outputFilename, sourcePricebookXml, 'utf8');
    }));

    logger.info(`Done writing ${sourcePricebookOutputs.length} pricebook output files`);
    return;
  }

  const generatePricebookAmount = createPricebookAmountGenerator(selectorConfig);

  if (!beautifyOutput) {
    await writeXmlChunks(defaultPricebookOutputFilename, buildCompactPricebookChunks(productSelection, generatePricebookAmount));
    logger.info('Done writing pricebook output file');
    return;
  }

  const pricebookXML = await serializeXml(buildPricebook(productSelection, generatePricebookAmount), beautifyOutput, logger);

  await fsPromises.writeFile(defaultPricebookOutputFilename, pricebookXML, 'utf8');
  logger.info('Done writing pricebook output file');
};

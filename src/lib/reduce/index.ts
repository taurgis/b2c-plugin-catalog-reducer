// Orchestrator for the catalog reduce workflow: parses the input file,
// applies selectors, and writes catalog/inventory/pricebook/storefront
// output. This is the direct successor to the legacy monolithic
// lib/parser.js's `exports.parse`, split into focused step modules
// (catalogId, selectAndNormalize, writeCatalog, writeInventory,
// writePricebook, writeStorefront) per the M1 port plan.
import chalk from 'chalk';

import {normalizeRuntimeOptions} from '../runtimeSupport';
import {Logger, RuntimeOptions, SelectorConfig, XmlNode} from '../types';
import {determineCatalog} from './catalogId';
import {buildSelection, selectAndNormalizeProducts} from './selectAndNormalize';
import {writeCatalogXml} from './writeCatalog';
import {writeInventoryXml} from './writeInventory';
import {writePricebookXml} from './writePricebook';
import {getConfiguredStorefrontSourceFiles, writeStorefrontXml} from './writeStorefront';
import {deriveOutputFilename, shouldBeautifyOutput} from './xmlSerialization';

const writeDerivedOutputs = async (
  outputFilename: string,
  selectedProducts: XmlNode[],
  selectorConfig: SelectorConfig,
  beautifyOutput: boolean,
  logger: Logger
): Promise<void> => {
  const inventoryOutputFilename = deriveOutputFilename(outputFilename, '-inventory');
  const hasStorefrontSourceFiles = getConfiguredStorefrontSourceFiles(selectorConfig).length > 0;
  const derivedOutputLabels = hasStorefrontSourceFiles
    ? 'inventory, pricebook, and storefront catalog files'
    : 'inventory and pricebook files';

  logger.info(chalk.yellow(`Writing ${derivedOutputLabels}`));

  await Promise.all([
    writeInventoryXml(inventoryOutputFilename, selectedProducts, beautifyOutput, logger),
    writePricebookXml(outputFilename, selectedProducts, selectorConfig, beautifyOutput, logger),
    writeStorefrontXml(outputFilename, selectedProducts, selectorConfig, logger)
  ]);
};

/**
 * Parses the input file, applies selectors and writes to the output file.
 * Faithful successor to legacy `lib/parser.js`'s `exports.parse` - same
 * signature, same behavior.
 */
export const parseCatalog = async (
  inputFilename: string,
  outputFilename: string,
  selectorConfig: SelectorConfig,
  runtimeOptions?: RuntimeOptions
): Promise<void> => {
  const runtime = normalizeRuntimeOptions(runtimeOptions);
  const {logger} = runtime;
  const catalogId = await determineCatalog(inputFilename, logger);
  const beautifyOutput = shouldBeautifyOutput(selectorConfig);
  const selectedProducts = await selectAndNormalizeProducts(inputFilename, selectorConfig, runtime);

  if (runtime.dryRun) {
    logger.info(chalk.yellow(`Dry run: would write ${selectedProducts.length} selected product(s). No files were written.`));
    return;
  }

  const selection = buildSelection(catalogId, selectedProducts);

  logger.info(chalk.yellow('Writing catalog file'));
  await writeCatalogXml(outputFilename, selection, beautifyOutput, logger);
  await writeDerivedOutputs(outputFilename, selectedProducts, selectorConfig, beautifyOutput, logger);
};

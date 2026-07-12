// Pure, side-effect-free-at-import-time entrypoint for the catalog reduce
// workflow. This is the in-process successor to legacy `reducer.js`, which
// used to run `yargs(...).argv` and `main().catch(...)` at module load time
// (parsing the *host* process's argv and calling `process.exit`/emitting
// warnings as an import side effect) - unsafe to import into a long-lived
// oclif process. This function has none of that: it takes an explicit
// options object, does no argv/process.exit/process.emitWarning work of its
// own at import time, and can be called repeatedly and concurrently within
// the same process (see selectionCache/runtimeSupport - both are already
// free of module-level mutable state, so nothing here needs to be reset
// between invocations).
import path from 'node:path';

import chalk from 'chalk';

import {DEFAULT_SELECTOR_CONFIG, loadConfigFile} from '../selectorConfig';
import {Logger, SelectorConfig} from '../types';
import {validateGeneratedOutputs} from '../xmlSchemaValidator';
import {parseCatalog} from './index';

export interface RunCatalogReduceOptions {
  /** Path to a JSON config file. Relative paths are resolved from invocationCwd. */
  config?: string;
  /** Reuse a cached product selection when the input file and config are unchanged. Defaults to true. */
  cache?: boolean;
  /** Run product selection and skip writing any output files/XSD validation. Defaults to false. */
  dryRun?: boolean;
  /** The source catalog XML file. */
  input: string;
  /** Directory relative paths (input/output/config) are resolved from. Defaults to process.cwd(). */
  invocationCwd?: string;
  /** The output catalog XML file. */
  output: string;
  /** Optional logger; defaults to a console+chalk logger matching the legacy CLI's terminal output. */
  logger?: Logger;
}

export interface RunCatalogReduceResult {
  dryRun: boolean;
  selectorConfig: SelectorConfig;
}

const resolveCliPath = (inputPath: string, invocationCwd: string): string => (
  path.isAbsolute(inputPath) ? inputPath : path.resolve(invocationCwd, inputPath)
);

/**
 * Runs product selection (and, unless `dryRun` is set, writes the reduced
 * catalog/inventory/pricebook/storefront outputs and validates them against
 * the bundled XSD schemas). Throws on any failure; never calls
 * `process.exit`.
 */
export const runCatalogReduce = async (options: RunCatalogReduceOptions): Promise<RunCatalogReduceResult> => {
  const invocationCwd = options.invocationCwd ?? process.cwd();
  const logger: Logger = options.logger ?? {
    info: (...args: unknown[]) => console.log(...args),
    warn: (...args: unknown[]) => console.warn(...args),
    error: (...args: unknown[]) => console.error(...args)
  };

  const selectorConfig: SelectorConfig = options.config
    ? await loadConfigFile(options.config, invocationCwd)
    : DEFAULT_SELECTOR_CONFIG;

  const inputFilename = resolveCliPath(options.input, invocationCwd);
  const outputFilename = resolveCliPath(options.output, invocationCwd);

  logger.info(chalk.blue('\nRunning catalog reducer with the following config:'));
  logger.info(chalk.yellow('------------------------------'));
  logger.info(chalk.yellow(JSON.stringify(selectorConfig, null, 4)));
  logger.info(chalk.yellow('------------------------------\n'));

  await parseCatalog(inputFilename, outputFilename, selectorConfig, {
    dryRun: options.dryRun,
    useCache: options.cache,
    logger
  });

  if (options.dryRun) {
    logger.info(chalk.yellow('Dry run complete. No files were written; skipping XSD validation.'));
    return {dryRun: true, selectorConfig};
  }

  logger.info(chalk.yellow('Validating generated XML files against XSD schemas'));
  await validateGeneratedOutputs(outputFilename, undefined, selectorConfig);
  logger.info(chalk.green('XSD validation passed.'));
  logger.info(chalk.yellow('Done!'));

  return {dryRun: false, selectorConfig};
};

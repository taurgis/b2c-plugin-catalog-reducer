import './vendor-shims';
import chalk from 'chalk';
import cliProgress from 'cli-progress';

import {Logger, NormalizedRuntime, ProgressBar, RuntimeOptions} from './types';

const NO_OP_PROGRESS: ProgressBar = Object.freeze({
  start: () => {},
  stop: () => {},
  update: () => {},
  setTotal: () => {}
});

const NO_OP_LOGGER: Logger = Object.freeze({
  info: () => {},
  warn: () => {},
  error: () => {}
});

const PROGRESS_BAR_OPTIONS = {
  format: 'Progress | {bar} | {value}/{total} | '
    + chalk.blue('Filter:') + ' ' + chalk.yellow('{filter}')
    + ' | Processing Product: ' + chalk.red('{productId}'),
  hideCursor: true
};

const isProgressLike = (value: any): boolean => {
  return !!value
    && typeof value.start === 'function'
    && typeof value.stop === 'function'
    && typeof value.update === 'function'
    && typeof value.setTotal === 'function';
};

// Recognized boolean runtime flags, declared once so adding a new one never
// requires hand-syncing coercion/default logic across multiple call sites.
const RUNTIME_FLAG_DEFAULTS: Record<string, {coerce: (value: unknown) => boolean; default: boolean}> = {
  dryRun: {coerce: value => value === true, default: false},
  useCache: {coerce: value => value !== false, default: true}
};

const resolveRuntimeFlags = (source: Record<string, any> = {}): {dryRun: boolean; useCache: boolean} => Object.fromEntries(
  Object.entries(RUNTIME_FLAG_DEFAULTS).map(([key, {coerce, default: defaultValue}]) => (
    [key, key in source ? coerce(source[key]) : defaultValue]
  ))
) as {dryRun: boolean; useCache: boolean};

const normalizeLogger = (logger: any): Logger => ({
  info: logger && typeof logger.info === 'function' ? logger.info.bind(logger) : NO_OP_LOGGER.info,
  warn: logger && typeof logger.warn === 'function' ? logger.warn.bind(logger) : NO_OP_LOGGER.warn,
  error: logger && typeof logger.error === 'function' ? logger.error.bind(logger) : NO_OP_LOGGER.error
});

const createConsoleLogger = (): Logger => ({
  info: (...args: any[]) => console.info(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args)
});

const createProgressBar = (): ProgressBar => {
  if (!process.stderr || !process.stderr.isTTY) {
    return NO_OP_PROGRESS;
  }

  return new cliProgress.SingleBar(PROGRESS_BAR_OPTIONS, cliProgress.Presets.shades_classic);
};

export const normalizeRuntimeOptions = (runtimeOrProgress?: RuntimeOptions | ProgressBar | any): NormalizedRuntime => {
  if (isProgressLike(runtimeOrProgress)) {
    return {
      ...resolveRuntimeFlags(),
      logger: createConsoleLogger(),
      progress: runtimeOrProgress as ProgressBar
    };
  }

  const runtime: RuntimeOptions = runtimeOrProgress || {};
  const progress = isProgressLike(runtime.progress)
    ? (runtime.progress as ProgressBar)
    : runtime.enableProgress === false
      ? NO_OP_PROGRESS
      : createProgressBar();

  return {
    ...resolveRuntimeFlags(runtime as Record<string, any>),
    logger: normalizeLogger(runtime.logger || createConsoleLogger()),
    progress
  };
};

export const createSilentRuntime = (): NormalizedRuntime => ({
  ...resolveRuntimeFlags(),
  logger: NO_OP_LOGGER,
  progress: NO_OP_PROGRESS
});

export {NO_OP_LOGGER, NO_OP_PROGRESS};

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

const FALSY_FLAG_STRINGS = new Set(['false', '0', 'no', 'off', 'n']);
const TRUTHY_FLAG_STRINGS = new Set(['true', '1', 'yes', 'on', 'y']);

// Loosely coerces a runtime flag value to a boolean. RuntimeOptions types
// these fields as `boolean`, but callers outside the TypeScript-checked CLI
// path (programmatic/library use) may pass other truthy/falsy
// representations (e.g. from a config file or env var), so this recognizes
// common non-boolean forms instead of silently treating anything that isn't
// strictly `true`/`false` as the opposite of what was intended. Only called
// for values actually present on the source object (see
// `resolveRuntimeFlags`) - `undefined`/absent always falls back to the
// flag's own default rather than reaching this function.
const coerceRuntimeFlag = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (FALSY_FLAG_STRINGS.has(normalized)) {
      return false;
    }

    if (TRUTHY_FLAG_STRINGS.has(normalized)) {
      return true;
    }
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return Boolean(value);
};

// Recognized boolean runtime flags, declared once so adding a new one never
// requires hand-syncing coercion/default logic across multiple call sites.
const RUNTIME_FLAG_DEFAULTS: Record<string, {coerce: (value: unknown) => boolean; default: boolean}> = {
  dryRun: {coerce: coerceRuntimeFlag, default: false},
  useCache: {coerce: coerceRuntimeFlag, default: true}
};

const resolveRuntimeFlags = (source: Record<string, any> = {}): {dryRun: boolean; useCache: boolean} => Object.fromEntries(
  Object.entries(RUNTIME_FLAG_DEFAULTS).map(([key, {coerce, default: defaultValue}]) => (
    // `source[key] === undefined` is treated the same as the key being
    // absent entirely - a present-but-undefined value (e.g. `{cache:
    // options.cache}` when the caller omitted `cache`) means "not
    // specified", not "explicitly falsy", and must fall back to the
    // flag's own default rather than being coerced.
    [key, key in source && source[key] !== undefined ? coerce(source[key]) : defaultValue]
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

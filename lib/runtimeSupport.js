const chalk = require('chalk');
const cliProgress = require('cli-progress');

const NO_OP_PROGRESS = Object.freeze({
    start: () => {},
    stop: () => {},
    update: () => {},
    setTotal: () => {}
});

const NO_OP_LOGGER = Object.freeze({
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

const isProgressLike = value => {
    return !!value
        && typeof value.start === 'function'
        && typeof value.stop === 'function'
        && typeof value.update === 'function'
        && typeof value.setTotal === 'function';
};

// Recognized boolean runtime flags, declared once so adding a new one never
// requires hand-syncing coercion/default logic across multiple call sites.
const RUNTIME_FLAG_DEFAULTS = {
    dryRun: { coerce: value => value === true, default: false },
    useCache: { coerce: value => value !== false, default: true }
};

const resolveRuntimeFlags = (source = {}) => Object.fromEntries(
    Object.entries(RUNTIME_FLAG_DEFAULTS).map(([key, { coerce, default: defaultValue }]) => (
        [key, key in source ? coerce(source[key]) : defaultValue]
    ))
);

const normalizeLogger = logger => ({
    info: logger && typeof logger.info === 'function' ? logger.info.bind(logger) : NO_OP_LOGGER.info,
    warn: logger && typeof logger.warn === 'function' ? logger.warn.bind(logger) : NO_OP_LOGGER.warn,
    error: logger && typeof logger.error === 'function' ? logger.error.bind(logger) : NO_OP_LOGGER.error
});

const createConsoleLogger = () => ({
    info: (...args) => console.info(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
});

const createProgressBar = () => {
    if (!process.stderr || !process.stderr.isTTY) {
        return NO_OP_PROGRESS;
    }

    return new cliProgress.SingleBar(PROGRESS_BAR_OPTIONS, cliProgress.Presets.shades_classic);
};

const normalizeRuntimeOptions = runtimeOrProgress => {
    if (isProgressLike(runtimeOrProgress)) {
        return {
            ...resolveRuntimeFlags(),
            logger: createConsoleLogger(),
            progress: runtimeOrProgress
        };
    }

    const runtime = runtimeOrProgress || {};
    const progress = isProgressLike(runtime.progress)
        ? runtime.progress
        : runtime.enableProgress === false
            ? NO_OP_PROGRESS
            : createProgressBar();

    return {
        ...resolveRuntimeFlags(runtime),
        logger: normalizeLogger(runtime.logger || createConsoleLogger()),
        progress
    };
};

const createSilentRuntime = () => ({
    ...resolveRuntimeFlags(),
    logger: NO_OP_LOGGER,
    progress: NO_OP_PROGRESS
});

module.exports = {
    createSilentRuntime,
    normalizeRuntimeOptions,
    NO_OP_LOGGER,
    NO_OP_PROGRESS
};

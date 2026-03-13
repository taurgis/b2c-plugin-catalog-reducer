const fsPromises = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_SELECTOR_CONFIG = {
    total: 0,
    master: 0,
    productIds: [],
    attributes: {
        custom: []
    },
    pricebookRandomSeed: null,
    pricebookSourceFiles: []
};

const mergeConfig = loadedConfig => ({
    ...DEFAULT_SELECTOR_CONFIG,
    ...loadedConfig,
    attributes: {
        ...DEFAULT_SELECTOR_CONFIG.attributes,
        ...(loadedConfig && loadedConfig.attributes ? loadedConfig.attributes : {})
    }
});

const normalizeConfigRelativePaths = (selectorConfig, configFilePath) => {
    if (!configFilePath || !Array.isArray(selectorConfig.pricebookSourceFiles)) {
        return selectorConfig;
    }

    const configDirectory = path.dirname(configFilePath);

    return {
        ...selectorConfig,
        pricebookSourceFiles: selectorConfig.pricebookSourceFiles.map(sourceFilePath => {
            if (typeof sourceFilePath !== 'string' || sourceFilePath.trim() === '') {
                return sourceFilePath;
            }

            if (path.isAbsolute(sourceFilePath)) {
                return sourceFilePath;
            }

            return path.resolve(configDirectory, sourceFilePath);
        })
    };
};

const resolveConfigPath = (configFilePath, invocationCwd = process.cwd()) => {
    if (path.isAbsolute(configFilePath)) {
        return configFilePath;
    }

    return path.resolve(invocationCwd, configFilePath);
};

const loadConfigFile = async (configFilePath, invocationCwd = process.cwd()) => {
    const resolvedConfigFilePath = resolveConfigPath(configFilePath, invocationCwd);
    const configFileContents = await fsPromises.readFile(resolvedConfigFilePath, 'utf8');
    const parsedConfig = JSON.parse(configFileContents);

    return normalizeConfigRelativePaths(mergeConfig(parsedConfig), resolvedConfigFilePath);
};

module.exports = {
    DEFAULT_SELECTOR_CONFIG,
    loadConfigFile,
    resolveConfigPath
};
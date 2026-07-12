import fsPromises from 'node:fs/promises';
import path from 'node:path';

import {convertFriendlyConfigToCanonical, isFriendlyConfigShape} from './friendlyConfig';
import {SelectorConfig} from './types';

export const DEFAULT_SELECTOR_CONFIG: SelectorConfig = {
  total: 0,
  master: 0,
  productIds: [],
  attributes: {
    custom: []
  },
  onlineSiteIds: [],
  pricebookRandomSeed: null,
  pricebookSourceFiles: [],
  storefrontSourceFiles: []
};

const mergeConfig = (loadedConfig: SelectorConfig): SelectorConfig => ({
  ...DEFAULT_SELECTOR_CONFIG,
  ...loadedConfig,
  attributes: {
    ...DEFAULT_SELECTOR_CONFIG.attributes,
    ...(loadedConfig && loadedConfig.attributes ? loadedConfig.attributes : {})
  }
});

const normalizeConfigRelativePaths = (selectorConfig: SelectorConfig, configFilePath?: string): SelectorConfig => {
  if (!configFilePath) {
    return selectorConfig;
  }

  const configDirectory = path.dirname(configFilePath);
  const normalizeSourceFilePaths = (sourceFiles: unknown) => {
    if (!Array.isArray(sourceFiles)) {
      return sourceFiles;
    }

    return sourceFiles.map(sourceFilePath => {
      if (typeof sourceFilePath !== 'string' || sourceFilePath.trim() === '') {
        return sourceFilePath;
      }

      if (path.isAbsolute(sourceFilePath)) {
        return sourceFilePath;
      }

      return path.resolve(configDirectory, sourceFilePath);
    });
  };

  return {
    ...selectorConfig,
    pricebookSourceFiles: normalizeSourceFilePaths(selectorConfig.pricebookSourceFiles),
    storefrontSourceFiles: normalizeSourceFilePaths(selectorConfig.storefrontSourceFiles)
  };
};

export const resolveConfigPath = (configFilePath: string, invocationCwd: string = process.cwd()): string => {
  if (path.isAbsolute(configFilePath)) {
    return configFilePath;
  }

  return path.resolve(invocationCwd, configFilePath);
};

export const loadConfigFile = async (configFilePath: string, invocationCwd: string = process.cwd()): Promise<SelectorConfig> => {
  const resolvedConfigFilePath = resolveConfigPath(configFilePath, invocationCwd);
  const configFileContents = await fsPromises.readFile(resolvedConfigFilePath, 'utf8');
  const parsedConfig = JSON.parse(configFileContents);

  const canonicalConfig = isFriendlyConfigShape(parsedConfig)
    ? convertFriendlyConfigToCanonical(parsedConfig)
    : parsedConfig;

  return normalizeConfigRelativePaths(mergeConfig(canonicalConfig), resolvedConfigFilePath);
};

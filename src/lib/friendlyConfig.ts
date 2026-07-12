import {SelectorConfig} from './types';

// A friendlier, nested config shape offered alongside the canonical flat
// shape (DEFAULT_SELECTOR_CONFIG in selectorConfig.ts). Discriminated by an
// explicit, unambiguous `$schema` marker rather than heuristic field
// sniffing - the canonical shape never has this key, so there is no
// classification ambiguity between the two shapes.
export const FRIENDLY_CONFIG_SCHEMA_MARKER = 'catalog-reducer-config@1';

export interface FriendlyConfig {
  $schema: string;
  selection?: {
    totalProducts?: number;
    masterProducts?: number;
    productIds?: string[];
    attributes?: Array<{id: string; value?: string; count: number}>;
  };
  sites?: {
    onlineSiteIds?: string[];
  };
  pricebook?: {
    randomSeed?: number | string | null;
    sourceFiles?: string[];
  };
  storefront?: {
    sourceFiles?: string[];
  };
  output?: {
    beautify?: boolean;
  };
}

export const isFriendlyConfigShape = (parsedConfig: unknown): parsedConfig is FriendlyConfig => (
  Boolean(parsedConfig)
  && typeof parsedConfig === 'object'
  && Object.prototype.hasOwnProperty.call(parsedConfig, '$schema')
);

export const convertFriendlyConfigToCanonical = (friendlyConfig: FriendlyConfig): Partial<SelectorConfig> => {
  if (friendlyConfig.$schema !== FRIENDLY_CONFIG_SCHEMA_MARKER) {
    throw new Error(
      `Unsupported config $schema "${friendlyConfig.$schema}". `
      + `Expected "${FRIENDLY_CONFIG_SCHEMA_MARKER}", or omit $schema entirely to use the canonical flat config shape.`
    );
  }

  const {selection, sites, pricebook, storefront, output} = friendlyConfig;
  const canonicalConfig: Partial<SelectorConfig> = {};

  if (selection) {
    if (selection.totalProducts !== undefined) {
      canonicalConfig.total = selection.totalProducts;
    }

    if (selection.masterProducts !== undefined) {
      canonicalConfig.master = selection.masterProducts;
    }

    if (selection.productIds !== undefined) {
      canonicalConfig.productIds = selection.productIds;
    }

    if (selection.attributes !== undefined) {
      canonicalConfig.attributes = {custom: selection.attributes};
    }
  }

  if (sites && sites.onlineSiteIds !== undefined) {
    canonicalConfig.onlineSiteIds = sites.onlineSiteIds;
  }

  if (pricebook) {
    if (pricebook.randomSeed !== undefined) {
      canonicalConfig.pricebookRandomSeed = pricebook.randomSeed;
    }

    if (pricebook.sourceFiles !== undefined) {
      canonicalConfig.pricebookSourceFiles = pricebook.sourceFiles;
    }
  }

  if (storefront && storefront.sourceFiles !== undefined) {
    canonicalConfig.storefrontSourceFiles = storefront.sourceFiles;
  }

  if (output && output.beautify !== undefined) {
    canonicalConfig.beautify = output.beautify;
  }

  return canonicalConfig;
};

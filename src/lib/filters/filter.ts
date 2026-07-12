import chalk from 'chalk';

import {extractProductIds} from '../modelNormalization';
import {openProductStream} from '../productXmlStream';
import {Logger, ProgressBar, SelectorConfig, XmlNode} from '../types';

const parseBoolean = (value: any): boolean => {
  if (Array.isArray(value)) {
    return value.some(item => parseBoolean(item) === true);
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  if (value && typeof value === 'object' && value.$text !== undefined) {
    return parseBoolean(value.$text);
  }

  return false;
};

/**
 * Legacy online check: any true flag (site-specific or global) counts as
 * online. Used when no `onlineSiteIds` restriction is configured.
 */
const isOnlineByAnyFlag = (value: any): boolean => {
  if (value === true || value === 1 || value === 'true') {
    return true;
  }

  return parseBoolean(value);
};

/**
 * Site-restricted online check: a configured site counts as online if it
 * has an explicit site-specific `online-flag` of `true`, or - when that
 * site has no explicit override - if the global flag is `true` (inheriting
 * the default, per SFCC's per-site attribute override model).
 */
const isOnlineForConfiguredSites = (value: any, siteIdSet: Set<string>): boolean => {
  const flags = Array.isArray(value) ? value : [value];
  const siteSpecificFlags = new Map<string, boolean>();
  let hasGlobalFlag = false;
  let isGlobalOnline = false;

  for (const flag of flags) {
    const siteId = flag && typeof flag === 'object' && flag.$attrs ? flag.$attrs['site-id'] : undefined;

    if (siteId) {
      siteSpecificFlags.set(siteId, parseBoolean(flag) === true);
    } else {
      hasGlobalFlag = true;
      isGlobalOnline = isGlobalOnline || parseBoolean(flag) === true;
    }
  }

  for (const configuredSiteId of siteIdSet) {
    if (siteSpecificFlags.has(configuredSiteId)) {
      if (siteSpecificFlags.get(configuredSiteId)) {
        return true;
      }
    } else if (hasGlobalFlag && isGlobalOnline) {
      return true;
    }
  }

  return false;
};

/**
 * Determine whether a product's online-flag(s) count as online, dispatching
 * to the legacy any-flag check or the `onlineSiteIds`-restricted check
 * depending on whether a site restriction is configured.
 */
const isOnlineFlagEnabled = (value: any, siteIdSet: Set<string> | null): boolean => (
  !siteIdSet || siteIdSet.size === 0
    ? isOnlineByAnyFlag(value)
    : isOnlineForConfiguredSites(value, siteIdSet)
);

const buildOnlineSiteIdSet = (selectorConfig: SelectorConfig): Set<string> | null => {
  const onlineSiteIds = selectorConfig && selectorConfig.onlineSiteIds;

  return Array.isArray(onlineSiteIds) && onlineSiteIds.length > 0 ? new Set(onlineSiteIds) : null;
};

export interface FilterResult {
  finished: boolean;
  selection?: XmlNode | null;
}

export interface FilterStatistics {
  total: number;
  master: number;
  variants: number;
  variationGroups: number;
  attributes: {custom: Record<string, number>};
  productIds: Set<string>;
}

export interface FilterRuntimeState {
  totalTarget: number;
  preferredProductIds: Set<string>;
  enableCapturedFiller?: boolean;
  fillerCandidates?: XmlNode[];
  fillerExcludedProductIds?: Set<string>;
  hasStandaloneFillerFilter?: boolean;
}

/**
 * Base class for filters for easy implementation of new filters.
 */
export default class Filter {
  static NOT_FINISHED: FilterResult = Object.freeze({finished: false});
  static FINISHED: FilterResult = Object.freeze({finished: true});
  static NOT_FINISHED_WITH_PRODUCT = (product: XmlNode): FilterResult => ({finished: false, selection: product});

  // Set by subclasses that capture filler candidates outside the standalone
  // FillerProductsFilter pass (see FillerProductsFilter.usesStandaloneFillerCapture).
  static usesStandaloneFillerCapture?: boolean;

  inputFile: string;
  selection: XmlNode[];
  selectorConfig: SelectorConfig;
  statistics: FilterStatistics;
  progress: ProgressBar;
  runtimeState: FilterRuntimeState;
  logger: Logger | Console;
  onlineSiteIdSet: Set<string> | null;

  constructor(
    inputFile: string,
    selectorConfig: SelectorConfig,
    statistics: FilterStatistics,
    progress: ProgressBar,
    runtimeState: FilterRuntimeState,
    logger: Logger | Console = console
  ) {
    this.inputFile = inputFile;
    this.selection = [];
    this.selectorConfig = selectorConfig;
    this.statistics = statistics;
    this.progress = progress;
    this.runtimeState = runtimeState;
    this.logger = logger;
    this.onlineSiteIdSet = buildOnlineSiteIdSet(selectorConfig);
  }

  getMasterLinkedProductIds(product: XmlNode): {variants: string[]; variationGroups: string[]} {
    if (!product.variations) {
      return {
        variants: [],
        variationGroups: []
      };
    }

    return {
      variants: extractProductIds(product.variations.variants, 'variant'),
      variationGroups: extractProductIds(product.variations['variation-groups'], 'variation-group')
    };
  }

  hasCapacity(): boolean {
    return this.runtimeState.totalTarget > 0 && this.statistics.total < this.runtimeState.totalTarget;
  }

  markSelectedProductId(productId: string | null | undefined): void {
    if (!productId) {
      return;
    }

    this.statistics.productIds.add(productId);
  }

  processMasterProduct(product: XmlNode): void {
    const {variants, variationGroups} = this.getMasterLinkedProductIds(product);

    this.runtimeState.totalTarget += variants.length + variationGroups.length;
    this.progress.setTotal(this.runtimeState.totalTarget);
    this.statistics.variants += variants.length;
    this.statistics.variationGroups += variationGroups.length;

    variants.forEach(productId => this.runtimeState.preferredProductIds.add(productId));
    variationGroups.forEach(productId => this.runtimeState.preferredProductIds.add(productId));
  }

  shouldSkip(): boolean {
    return false;
  }

  /**
   * Open the XML stream to process the given input file.
   */
  openStream() {
    return openProductStream(this.inputFile);
  }

  /**
   * Update the statistics as a result of the filtering.
   */
  updateStatistics = (productId: string | null | undefined): void => {
    if (!productId) {
      return;
    }

    this.statistics.total += 1;
    this.statistics.productIds.add(productId);
  };

  /**
   * Execute the filter.
   */
  execute(): Promise<XmlNode[]> {
    if (this.shouldSkip()) {
      return Promise.resolve(this.selection);
    }

    return new Promise<XmlNode[]>(((resolve, reject) => {
      const {stream, xml} = this.openStream();
      let isSettled = false;
      const filterName = this.constructor.name;

      const teardown = () => {
        if (typeof xml.pause === 'function') {
          xml.pause();
        }

        if (stream && !stream.destroyed) {
          stream.destroy();
        }

        xml.removeAllListeners('tag:product');
        xml.removeAllListeners('error');
        xml.removeAllListeners('end');
      };

      const settle = (error?: unknown, results?: XmlNode[]) => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        teardown();

        if (error) {
          reject(error);
          return;
        }

        resolve(results!);
      };

      xml.on('tag:product', (product: XmlNode) => {
        try {
          const productId = product && product.$attrs ? product.$attrs['product-id'] : null;

          if (!productId || this.statistics.productIds.has(productId)) {
            return;
          }

          const isOnline = isOnlineFlagEnabled(product['online-flag'], this.onlineSiteIdSet);

          if (!isOnline) {
            return;
          }

          const {finished, selection} = this.process(product);

          if (selection) {
            this.selection.push(selection);
            this.updateStatistics(productId);
            this.progress.update(this.statistics.total, {
              productId,
              filter: filterName
            });
          }

          if (finished) {
            settle(null, this.selection);
          }
        } catch (e) {
          settle(e);
        }
      });

      xml.on('error', error => {
        settle(error);
      });

      xml.on('end', () => {
        settle(null, this.selection);
      });
    }));
  }

  /**
   * Process a single product from the input file.
   */
  process(product: XmlNode): FilterResult {
    const productId = product.$attrs['product-id'];

    this.logger.warn(chalk.red('Unable to filter product ' + chalk.yellow(productId)));

    return Filter.FINISHED;
  }
}

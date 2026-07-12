const chalk = require('chalk');
const { extractProductIds } = require('../modelNormalization');
const { openProductStream } = require('../productXmlStream');

const parseBoolean = value => {
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
 * Determine whether a product's online-flag(s) count as online.
 *
 * `<online-flag>` may appear once as a global/default flag, or once per site
 * with a `site-id` attribute (SFCC site-specific online status, which
 * overrides the default per site). When `siteIdSet` is non-empty, a
 * configured site counts as online if it has an explicit site-specific flag
 * of `true`, or - when that site has no explicit override - if the global
 * flag is `true` (inheriting the default, per SFCC's per-site attribute
 * override model). When `siteIdSet` is empty/null, any true flag
 * (site-specific or global) counts as online, preserving prior behavior for
 * configs that don't set `onlineSiteIds`.
 *
 * @param {*} value - The parsed `online-flag` value(s) for a product.
 * @param {Set<string>|null} [siteIdSet] - Site IDs to check for online status.
 */
const isOnlineFlagEnabled = (value, siteIdSet) => {
    if (!siteIdSet || siteIdSet.size === 0) {
        if (value === true || value === 1 || value === 'true') {
            return true;
        }

        return parseBoolean(value);
    }

    const flags = Array.isArray(value) ? value : [value];
    const siteSpecificFlags = new Map();
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

const buildOnlineSiteIdSet = selectorConfig => {
    const onlineSiteIds = selectorConfig && selectorConfig.onlineSiteIds;

    return Array.isArray(onlineSiteIds) && onlineSiteIds.length > 0 ? new Set(onlineSiteIds) : null;
};

/**
 * Base class for filters for easy implementation of new filters.
 */
class Filter {
    static NOT_FINISHED = Object.freeze({ finished: false });
    static FINISHED = Object.freeze({ finished: true });
    static NOT_FINISHED_WITH_PRODUCT = (product) => ({ finished: false, selection: product});

    getMasterLinkedProductIds(product) {
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

    hasCapacity() {
        return this.runtimeState.totalTarget > 0 && this.statistics.total < this.runtimeState.totalTarget;
    }

    markSelectedProductId(productId) {
        if (!productId) {
            return;
        }

        this.statistics.productIds.add(productId);
    }

    processMasterProduct(product) {
        const { variants, variationGroups } = this.getMasterLinkedProductIds(product);

        this.runtimeState.totalTarget += variants.length + variationGroups.length;
        this.progress.setTotal(this.runtimeState.totalTarget);
        this.statistics.variants += variants.length;
        this.statistics.variationGroups += variationGroups.length;

        variants.forEach(productId => this.runtimeState.preferredProductIds.add(productId));
        variationGroups.forEach(productId => this.runtimeState.preferredProductIds.add(productId));
    }

    constructor(inputFile, selectorConfig, statistics, progress, runtimeState, logger = console) {
        this.inputFile = inputFile;
        this.selection = [];
        this.selectorConfig = selectorConfig;
        this.statistics = statistics;
        this.progress = progress;
        this.runtimeState = runtimeState;
        this.logger = logger;
        this.onlineSiteIdSet = buildOnlineSiteIdSet(selectorConfig);
    }

    shouldSkip() {
        return false;
    }

    /**
     * Open the XML stream to process the given input file.
     *
     * @return {EventEmitter} - The XML event emitter
     */
    openStream() {
        return openProductStream(this.inputFile);
    }

    /**
     * Update the statistics as a result of the filtering.
     *
     * @param {string} productId - The product SKU
     */
    updateStatistics = (productId) => {
        if (!productId) {
            return;
        }

        this.statistics.total += 1;
        this.statistics.productIds.add(productId);
    }

    /**
     * Execute the filter.
     *
     * @return {Promise<Array<Object>>} - The products filtered out of the XML file.
     */
    execute() {
        if (this.shouldSkip()) {
            return Promise.resolve(this.selection);
        }

        return new Promise(((resolve, reject) => {
            const { stream, xml } = this.openStream();
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

            const settle = (error, results) => {
                if (isSettled) {
                    return;
                }

                isSettled = true;
                teardown();

                if (error) {
                    reject(error);
                    return;
                }

                resolve(results);
            };

            xml.on('tag:product', (product) => {
                try {
                    const productId = product && product.$attrs ? product.$attrs['product-id'] : null;

                    if (!productId || this.statistics.productIds.has(productId)) {
                        return;
                    }

                    const isOnline = isOnlineFlagEnabled(product['online-flag'], this.onlineSiteIdSet);

                    if (!isOnline) {
                        return;
                    }

                    const { finished, selection } = this.process(product);

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
     *
     * @param {Object} product - Product from the input XML file
     * @return {{finished: boolean}|{product: null, finished: boolean}} - The result of the processing
     */
    process(product) {
        const productId = product.$attrs['product-id'];

        this.logger.warn(chalk.red('Unable to filter product ' + chalk.yellow(productId)));

        return Filter.FINISHED;
    }
}

module.exports = Filter;

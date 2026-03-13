const chalk = require('chalk');
const cliProgress = require('cli-progress');
const selectors = require('./selectors');
const { extractProductIds } = require('./modelNormalization');
const { normalizeSelectedProducts } = require('./normalizeSelectedProducts');
const { openProductStream } = require('./productXmlStream');

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

const isOnlineFlagEnabled = value => {
    if (value === true || value === 1 || value === 'true') {
        return true;
    }

    return parseBoolean(value);
};

const getMasterLinkedProductIds = product => {
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
};

const hasCapacity = (runtimeState, statistics) => {
    return runtimeState.totalTarget > 0 && statistics.total < runtimeState.totalTarget;
};

const buildProgressBar = () => {
    return new cliProgress.SingleBar({
        format: 'Progress | {bar} | {value}/{total} | '
            + chalk.blue('Filter:') + ' ' + chalk.yellow('{filter}')
            + ' | Processing Product: ' + chalk.red('{productId}'),
        hideCursor: true
    }, cliProgress.Presets.shades_classic);
};

const createSelectionState = selectorConfig => {
    const hasPreferredOrMasterSelection = !!(
        (Array.isArray(selectorConfig.productIds) && selectorConfig.productIds.length)
        || Number(selectorConfig.master) > 0
    );

    return {
        statistics: {
            total: 0,
            master: 0,
            variants: 0,
            variationGroups: 0,
            productIds: new Set()
        },
        runtimeState: {
            totalTarget: Number(selectorConfig.total) || 0,
            masterTarget: Number(selectorConfig.master) || 0,
            preferredProductIds: new Set(Array.isArray(selectorConfig.productIds) ? selectorConfig.productIds : []),
            enableCapturedFiller: hasPreferredOrMasterSelection,
            fillerCandidates: [],
            fillerExcludedProductIds: new Set()
        },
        selection: []
    };
};

const logSelectionSummary = ({ statistics, runtimeState, processingTimeSeconds }) => {
    console.log(chalk.blue('\nProcessing Time') + ': ' + `${processingTimeSeconds} seconds`);
    console.log(chalk.yellow('\n------------------------------\n'));
    console.log(chalk.blue('Processing finished') + ': \n'
        + chalk.green('\tTotal') + ': ' + chalk.yellow(statistics.total) + '\n'
        + chalk.green('\tMaster') + ': ' + chalk.yellow(statistics.master) + '\n'
        + chalk.green('\tVariation Groups') + ': ' + chalk.yellow(statistics.variationGroups) + '\n'
        + chalk.green('\tvariants') + ': ' + chalk.yellow(statistics.variants) + '\n'
    );
    console.log(chalk.blue('Preferred Products that did not make the selection') + ': \n'
        + chalk.red(runtimeState.preferredProductIds.size
            ? ('\t- ' + [...runtimeState.preferredProductIds].join('\n\t- '))
            : '\t(none)')
    );
};

const selectProductsSinglePass = (inputFilename, selectorConfig) => {
    const progress = buildProgressBar();
    const selectionState = createSelectionState(selectorConfig);
    const { statistics, runtimeState, selection } = selectionState;

    const selectProduct = (product, filterName) => {
        const productId = product.$attrs['product-id'];

        selection.push(product);
        statistics.productIds.add(productId);
        statistics.total += 1;

        progress.update(statistics.total, {
            productId,
            filter: filterName
        });
    };

    const processMasterProduct = product => {
        const { variants, variationGroups } = getMasterLinkedProductIds(product);

        runtimeState.totalTarget += variants.length + variationGroups.length;
        progress.setTotal(runtimeState.totalTarget);
        statistics.variants += variants.length;
        statistics.variationGroups += variationGroups.length;

        variants.forEach(productId => runtimeState.preferredProductIds.add(productId));
        variationGroups.forEach(productId => runtimeState.preferredProductIds.add(productId));
    };

    const captureFillerCandidate = (product, isMasterProduct) => {
        if (!runtimeState.enableCapturedFiller || !hasCapacity(runtimeState, statistics)) {
            return;
        }

        const productId = product.$attrs['product-id'];

        if (isMasterProduct) {
            const { variants, variationGroups } = getMasterLinkedProductIds(product);

            variants.forEach(variantId => runtimeState.fillerExcludedProductIds.add(variantId));
            variationGroups.forEach(variationGroupId => runtimeState.fillerExcludedProductIds.add(variationGroupId));
            return;
        }

        if (!product.images || runtimeState.fillerExcludedProductIds.has(productId)) {
            return;
        }

        if (runtimeState.fillerCandidates.length >= runtimeState.totalTarget) {
            return;
        }

        runtimeState.fillerCandidates.push(product);
    };

    const appendCapturedFillerSelection = () => {
        for (let i = 0; i < runtimeState.fillerCandidates.length; i++) {
            if (!hasCapacity(runtimeState, statistics)) {
                break;
            }

            const product = runtimeState.fillerCandidates[i];
            const productId = product.$attrs['product-id'];

            if (statistics.productIds.has(productId)) {
                continue;
            }

            selectProduct(product, 'CapturedFiller');
        }
    };

    return new Promise((resolve, reject) => {
        const begin = Date.now();
        const { stream, xml } = openProductStream(inputFilename);
        let isSettled = false;

        const settle = (error, result) => {
            if (isSettled) {
                return;
            }

            isSettled = true;

            if (typeof xml.pause === 'function') {
                xml.pause();
            }

            if (!stream.destroyed) {
                stream.destroy();
            }

            xml.removeAllListeners('tag:product');
            xml.removeAllListeners('error');
            xml.removeAllListeners('end');

            progress.stop();

            if (error) {
                reject(error);
                return;
            }

            const processingTimeSeconds = (Date.now() - begin) / 1000;
            logSelectionSummary({
                statistics,
                runtimeState,
                processingTimeSeconds
            });

            resolve(result);
        };

        progress.start(runtimeState.totalTarget, 0);

        xml.on('tag:product', product => {
            try {
                const productId = product && product.$attrs ? product.$attrs['product-id'] : null;

                if (!productId || statistics.productIds.has(productId)) {
                    return;
                }

                if (!isOnlineFlagEnabled(product['online-flag'])) {
                    return;
                }

                const isMaster = selectors.isMaster(product);

                if (runtimeState.enableCapturedFiller) {
                    if (hasCapacity(runtimeState, statistics)
                        && runtimeState.preferredProductIds.size
                        && isMaster
                        && runtimeState.preferredProductIds.has(productId)) {
                        runtimeState.preferredProductIds.delete(productId);
                        selectProduct(product, 'PreferredMasterProductsFilter');
                        processMasterProduct(product);
                        return;
                    }

                    if (runtimeState.masterTarget > 0 && statistics.master < runtimeState.masterTarget && isMaster) {
                        statistics.master += 1;
                        selectProduct(product, 'MasterFilter');
                        processMasterProduct(product);
                        return;
                    }

                    if (hasCapacity(runtimeState, statistics) && runtimeState.preferredProductIds.has(productId)) {
                        runtimeState.preferredProductIds.delete(productId);
                        selectProduct(product, 'PreferredProductsFilter');
                        return;
                    }

                    captureFillerCandidate(product, isMaster);
                    return;
                }

                if (!hasCapacity(runtimeState, statistics)) {
                    return;
                }

                if (!isMaster && product.images) {
                    selectProduct(product, 'FillerProductsFilter');
                    return;
                }

                if (product.variations) {
                    const { variants, variationGroups } = getMasterLinkedProductIds(product);

                    variants.forEach(linkedProductId => statistics.productIds.add(linkedProductId));
                    variationGroups.forEach(linkedProductId => statistics.productIds.add(linkedProductId));
                }
            } catch (error) {
                settle(error);
            }
        });

        xml.on('error', error => {
            settle(error);
        });

        xml.on('end', () => {
            appendCapturedFillerSelection();
            settle(null, {
                selection: normalizeSelectedProducts(selection),
                statistics,
                unresolvedPreferredProductIds: runtimeState.preferredProductIds
            });
        });
    });
};

module.exports = {
    selectProductsSinglePass
};

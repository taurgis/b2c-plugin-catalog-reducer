const chalk = require('chalk');
const log = console.log;
const cliProgress = require('cli-progress');
const { normalizeSelectedProducts } = require('./normalizeSelectedProducts');

/**
 * The filter manager, managing all filters to process the XML file and
 * make product selections.
 */
class FilterManager {
    statistics = {
        total: 0,
        master: 0,
        variants: 0,
        variationGroups: 0,
        attributes: {
            custom: {}
        },
        productIds: new Set()
    };

    constructor(inputFile, selectorConfig) {
        const hasCustomAttributeSelection = !!(
            selectorConfig
            && selectorConfig.attributes
            && Array.isArray(selectorConfig.attributes.custom)
            && selectorConfig.attributes.custom.length
        );
        const hasPreferredOrMasterSelection = !!(
            (Array.isArray(selectorConfig.productIds) && selectorConfig.productIds.length)
            || Number(selectorConfig.master) > 0
        );

        this.filters = [];
        this.selection = [];
        this.inputFile = inputFile;
        this.selectorConfig = selectorConfig;
        this.runtimeState = {
            totalTarget: Number(selectorConfig.total) || 0,
            preferredProductIds: new Set(Array.isArray(selectorConfig.productIds) ? selectorConfig.productIds : []),
            enableCapturedFiller: hasPreferredOrMasterSelection && !hasCustomAttributeSelection,
            fillerCandidates: [],
            fillerExcludedProductIds: new Set(),
            hasStandaloneFillerFilter: false
        };
        this.progress = new cliProgress.SingleBar({
            format: 'Progress | {bar} | {value}/{total} | '
                + chalk.blue('Filter:') + ' ' + chalk.yellow('{filter}')
                + ' | Processing Product: ' + chalk.red('{productId}'),
            hideCursor: true
        }, cliProgress.Presets.shades_classic);
    }

    #appendCapturedFillerSelection = () => {
        if (
            !this.runtimeState.enableCapturedFiller
            || this.runtimeState.hasStandaloneFillerFilter
            || !this.runtimeState.fillerCandidates.length
        ) {
            return;
        }

        for (let i = 0; i < this.runtimeState.fillerCandidates.length; i++) {
            if (!this.runtimeState.totalTarget || this.statistics.total >= this.runtimeState.totalTarget) {
                break;
            }

            const product = this.runtimeState.fillerCandidates[i];
            const productId = product && product.$attrs ? product.$attrs['product-id'] : null;

            if (!productId || this.statistics.productIds.has(productId)) {
                continue;
            }

            this.selection.push(product);
            this.statistics.productIds.add(productId);
            this.statistics.total += 1;
            this.progress.update(this.statistics.total, {
                productId,
                filter: 'CapturedFiller'
            });
        }
    }

    /**
     * Register a filter in the manager to be executed.
     *
     * @param {Function} Filter - The filter to be executed
     */
    registerFilter(Filter) {
        if (Filter.name === 'FillerProductsFilter') {
            this.runtimeState.hasStandaloneFillerFilter = true;
        }

        this.filters.push(new Filter(this.inputFile, this.selectorConfig, this.statistics, this.progress, this.runtimeState));
    }

    /**
     * Execute all registered filters on the given inputfile
     *
     * @return {Promise<void>} - The promise, if a filter fails it will be rejected
     */
    async executeFilters() {
        this.progress.start(this.runtimeState.totalTarget, 0);

        const begin = Date.now();

        for (let i = 0; i < this.filters.length; i++) {
            const filter = this.filters[i];

            if (typeof filter.shouldSkip === 'function' && filter.shouldSkip()) {
                continue;
            }

            const results = await filter.execute();
            this.selection.push(...results);
        }

        this.#appendCapturedFillerSelection();

        this.progress.stop();

        const timeSpent = (Date.now() - begin) / 1000 + " seconds";
        log(chalk.blue('\nProcessing Time') + ': ' + timeSpent);
        log(chalk.yellow('\n------------------------------\n'));
    }

    /**
     * Fixes the JSON structure to something more similar to the original XML file.
     */
    #fixJSONProducts = () => {
        this.selection = normalizeSelectedProducts(this.selection);
    }

    /**
     * Get the selected products.
     *
     * @return {{$name: string, product: *[], $attrs: {xmlns: string, 'catalog-id': string}}}
     */
    getSelection() {
        this.#fixJSONProducts();

        log(chalk.blue('Processing finished') + ': \n' +
            chalk.green('\tTotal') + ': ' + chalk.yellow(this.statistics.total) + '\n' +
            chalk.green('\tMaster') + ': ' + chalk.yellow(this.statistics.master) + '\n' +
            chalk.green('\tVariation Groups') + ': ' + chalk.yellow(this.statistics.variationGroups) + '\n' +
            chalk.green('\tvariants') + ': ' + chalk.yellow(this.statistics.variants) + '\n'
        );

        log(chalk.blue('Preferred Products that did not make the selection') + ': \n' +
            chalk.red(this.runtimeState.preferredProductIds.size
                ? ('\t- ' + [...this.runtimeState.preferredProductIds].join('\n\t- '))
                : '\t(none)')
        );

        return this.selection;
    }
}

module.exports = FilterManager;

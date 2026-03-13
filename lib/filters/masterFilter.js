const Filter = require('./filter');
const selectors = require('../selectors');

/**
 * Filter to get the masters from the given XML file.
 */
class MasterFilter extends Filter {
    constructor(inputFile, selectorConfig, statistics, progress, runtimeState) {
        super(inputFile, selectorConfig, statistics, progress, runtimeState);

        this.statistics.master = 0;
        this.statistics.variants = 0;
        this.statistics.variationGroups = 0;
    }

    updateStatistics = (productId) => {
        if(!productId) return;

        this.statistics.productIds.add(productId);
        this.statistics.total += 1;
        this.statistics.master += 1;
    }

    shouldSkip() {
        return !(this.selectorConfig.master && (this.statistics.master < this.selectorConfig.master));
    }

    process(product) {
        if (this.selectorConfig.master && (this.statistics.master < this.selectorConfig.master)) {
            const isMaster = selectors.isMaster(product);

            if (isMaster) {
                this.processMasterProduct(product);

                return Filter.NOT_FINISHED_WITH_PRODUCT(product);
            }

            return Filter.NOT_FINISHED;
        }

        return Filter.FINISHED;
    }
}

module.exports = MasterFilter;

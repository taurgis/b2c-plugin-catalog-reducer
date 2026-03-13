const Filter = require('./filter');
const selectors = require('../selectors');

/**
 * Filter out the preferred products from the given XML.
 */
class PreferredMasterProductsFilter extends Filter {
    shouldSkip() {
        return !this.hasCapacity() || !this.runtimeState.preferredProductIds.size;
    }

    process(product) {
        if (this.hasCapacity()) {
            if (product && this.runtimeState.preferredProductIds.size) {
                const productId = product.$attrs['product-id'];
                const isMaster = selectors.isMaster(product);

                if (isMaster && this.runtimeState.preferredProductIds.has(productId)) {
                    this.runtimeState.preferredProductIds.delete(productId);
                    this.processMasterProduct(product);

                    return Filter.NOT_FINISHED_WITH_PRODUCT(product);
                }

                return Filter.NOT_FINISHED;
            }
        }

        return Filter.FINISHED;
    }
}

module.exports = PreferredMasterProductsFilter;

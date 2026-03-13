const Filter = require('./filter');
const selectors = require('../selectors');

/**
 * Fetch products from the XML that have not been filtered out
 */
class FillerProductsFilter extends Filter {
    shouldSkip() {
        return !this.hasCapacity();
    }

    process(product) {
        if (this.hasCapacity()) {
            const isMaster = selectors.isMaster(product);

            if(!isMaster && product.images) {
                return Filter.NOT_FINISHED_WITH_PRODUCT(product);
            } else {
                if (product.variations) {
                    const { variants, variationGroups } = this.getMasterLinkedProductIds(product);

                    // If there are variants or variation groups add them to the already selected list to be filtered out.
                    variants.forEach(productId => this.markSelectedProductId(productId));
                    variationGroups.forEach(productId => this.markSelectedProductId(productId));
                }
            }

            return Filter.NOT_FINISHED;
        }

        return Filter.FINISHED;
    }
}

module.exports = FillerProductsFilter;

const fixOptions = require('./productModelFixers/fixOptions');
const fixCustomAttributes = require('./productModelFixers/fixCustomAttributes');
const fixPageAttributes = require('./productModelFixers/fixPageAttributes');
const fixProductSetProducts = require('./productModelFixers/fixProductSetProducts');
const fixImages = require('./productModelFixers/fixImages');
const {
    fixVariants,
    fixVariationVariants,
    fixVariationAttributes
} = require('./productModelFixers/fixVariants');

class ProductModelFixers {
    static fixOptions(product, modifiedProduct) {
        return fixOptions(product, modifiedProduct);
    }

    static fixCustomAttributes(product, modifiedProduct) {
        return fixCustomAttributes(product, modifiedProduct);
    }

    static fixPageAttributes(product, modifiedProduct) {
        return fixPageAttributes(product, modifiedProduct);
    }

    static fixProductSetProducts(product, modifiedProduct) {
        return fixProductSetProducts(product, modifiedProduct);
    }

    static fixVariants(product, modifiedProduct) {
        return fixVariants(product, modifiedProduct);
    }

    static fixVariationVariants(product, modifiedProduct) {
        return fixVariationVariants(product, modifiedProduct);
    }

    static fixVariationAttributes(product, modifiedProduct) {
        return fixVariationAttributes(product, modifiedProduct);
    }

    static fixImages(product, modifiedProduct) {
        return fixImages(product, modifiedProduct);
    }
}

module.exports = ProductModelFixers;

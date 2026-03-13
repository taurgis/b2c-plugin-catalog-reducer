const ProductModelFixers = require('./productModelFixers');

const normalizeProductForOutput = product => {
    // Keep the clone shallow for performance; fixers overwrite transformed branches explicitly.
    const sourceProduct = product;
    const modifiedProduct = {
        ...product
    };

    ProductModelFixers.fixCustomAttributes(sourceProduct, modifiedProduct);
    ProductModelFixers.fixVariants(sourceProduct, modifiedProduct);
    ProductModelFixers.fixImages(sourceProduct, modifiedProduct);
    ProductModelFixers.fixOptions(sourceProduct, modifiedProduct);
    ProductModelFixers.fixPageAttributes(sourceProduct, modifiedProduct);
    ProductModelFixers.fixProductSetProducts(sourceProduct, modifiedProduct);

    return modifiedProduct;
};

const normalizeSelectedProducts = selectedProducts => selectedProducts.map(normalizeProductForOutput);

module.exports = {
    normalizeSelectedProducts,
    normalizeProductForOutput
};

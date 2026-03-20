const { toArray, toProductId } = require('../modelNormalization');

const normalizeBundledProductsInput = bundledProducts => {
    const entries = toArray(bundledProducts);

    if (entries.length === 1 && entries[0] && entries[0]['bundled-product'] !== undefined) {
        return toArray(entries[0]['bundled-product']);
    }

    return entries;
};

const normalizeQuantity = bundledProduct => {
    if (!bundledProduct || typeof bundledProduct !== 'object' || bundledProduct.quantity === undefined) {
        return '1';
    }

    if (bundledProduct.quantity && typeof bundledProduct.quantity === 'object') {
        return bundledProduct.quantity.$text !== undefined
            ? bundledProduct.quantity.$text
            : '1';
    }

    return bundledProduct.quantity;
};

module.exports = function fixBundledProducts(product, modifiedProduct) {
    if (!product['bundled-products']) {
        return;
    }

    const bundledProducts = normalizeBundledProductsInput(product['bundled-products'])
        .map(bundledProduct => {
            const productId = toProductId(bundledProduct);

            if (!productId) {
                return null;
            }

            return {
                $attrs: {
                    'product-id': productId
                },
                quantity: normalizeQuantity(bundledProduct)
            };
        })
        .filter(Boolean);

    if (bundledProducts.length === 0) {
        delete modifiedProduct['bundled-products'];
        return;
    }

    modifiedProduct['bundled-products'] = {
        'bundled-product': bundledProducts
    };
};

module.exports = function fixProductSetProducts(product, modifiedProduct) {
    if (product['product-set-products']) {
        if (!Array.isArray(product['product-set-products'])) {
            product['product-set-products'] = [product['product-set-products']];
        }

        modifiedProduct['product-set-products'] = {
            'product-set-product': product['product-set-products'].map(productSetProduct => {
                return {
                    $attrs: {
                        'product-id': productSetProduct
                    }
                };
            })
        };
    }
};

module.exports = function fixPageAttributes(product, modifiedProduct) {
    if (product['page-attributes']) {
        if (!Array.isArray(product['page-attributes'])) {
            product['page-attributes'] = [product['page-attributes']];
        }

        modifiedProduct['page-attributes'] = product['page-attributes'];
    }
};

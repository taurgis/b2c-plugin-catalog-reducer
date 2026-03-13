module.exports = function fixCustomAttributes(product, modifiedProduct) {
    if (product['custom-attributes']) {
        if (!Array.isArray(product['custom-attributes'])) {
            product['custom-attributes'] = [product['custom-attributes']];
        }

        modifiedProduct['custom-attributes'] = {
            'custom-attribute': product['custom-attributes']
        };
    }
};

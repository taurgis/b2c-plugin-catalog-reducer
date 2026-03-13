module.exports = function fixOptions(product, modifiedProduct) {
    if (product.options) {
        if (!Array.isArray(product.options)) {
            product.options = [product.options];
        }

        modifiedProduct.options = {
            'shared-option': product.options.map(option => {
                return {
                    $attrs: {
                        'option-id': option
                    }
                };
            })
        };
    }
};

const { toArray } = require('../modelNormalization');

const toOptionId = option => {
    if (typeof option === 'string') {
        return option;
    }

    if (option && option.$attrs && option.$attrs['option-id']) {
        return option.$attrs['option-id'];
    }

    if (option && option['option-id']) {
        return option['option-id'];
    }

    return null;
};

module.exports = function fixOptions(product, modifiedProduct) {
    if (!product.options) {
        return;
    }

    const optionIds = toArray(product.options)
        .map(toOptionId)
        .filter(Boolean);

    if (optionIds.length === 0) {
        delete modifiedProduct.options;
        return;
    }

    modifiedProduct.options = {
        'shared-option': optionIds.map(optionId => {
            return {
                $attrs: {
                    'option-id': optionId
                }
            };
        })
    };
};

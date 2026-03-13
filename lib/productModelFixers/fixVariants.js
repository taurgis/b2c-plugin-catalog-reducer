const { extractProductIds } = require('../modelNormalization');

const fixVariationVariants = (product, modifiedProduct) => {
    const variants = extractProductIds(product.variations.variants, 'variant');

    modifiedProduct.variations.variants = {
        variant: variants.map(variant => {
            return {
                $attrs: {
                    'product-id': variant
                }
            };
        })
    };

    const variationGroups = extractProductIds(product.variations['variation-groups'], 'variation-group');

    if (variationGroups.length) {
        modifiedProduct.variations['variation-groups'] = {
            'variation-group': variationGroups.map(variationGroup => {
                return {
                    $attrs: {
                        'product-id': variationGroup
                    }
                };
            })
        };
    }
};

const fixVariationAttributes = (product, modifiedProduct) => {
    const variationAttribute = product.variations.attributes['variation-attribute'];

    if (!Array.isArray(variationAttribute)) {
        modifiedProduct.variations.attributes['variation-attribute'] = [product.variations.attributes['variation-attribute']];
    }

    if (!Array.isArray(modifiedProduct.variations.variants)) {
        modifiedProduct.variations.variants = [modifiedProduct.variations.variants];
    }

    modifiedProduct.variations.attributes = {
        'variation-attribute': modifiedProduct.variations.attributes
    };

    if (!Array.isArray(modifiedProduct.variations.attributes['variation-attribute'])) {
        modifiedProduct.variations.attributes['variation-attribute'] = [modifiedProduct.variations.attributes['variation-attribute']];
    }

    modifiedProduct.variations.attributes['variation-attribute'] = modifiedProduct.variations.attributes['variation-attribute'].map(
        sourceVariationAttribute => {
            const modifiedVariationAttribute = sourceVariationAttribute;

            if (sourceVariationAttribute['variation-attribute-values']) {
                if (!Array.isArray(sourceVariationAttribute['variation-attribute-values'])) {
                    modifiedVariationAttribute['variation-attribute-values'] = [sourceVariationAttribute['variation-attribute-values']];
                }

                modifiedVariationAttribute['variation-attribute-values'] = {
                    'variation-attribute-value': modifiedVariationAttribute['variation-attribute-values'].map(variationAttributeValue => {
                        return {
                            'display-value': variationAttributeValue['display-value'],
                            $attrs: {
                                value: variationAttributeValue.$attrs ? variationAttributeValue.$attrs.value : null
                            }
                        };
                    })
                };
            } else {
                return {
                    $attrs: {
                        'attribute-id': sourceVariationAttribute['attribute-id'],
                        'variation-attribute-id': sourceVariationAttribute['variation-attribute-id']
                    }
                };
            }

            return modifiedVariationAttribute;
        }
    );
};

const fixVariants = (product, modifiedProduct) => {
    if (product.variations) {
        if (product.variations.variants && product.variations.attributes) {
            fixVariationAttributes(product, modifiedProduct);
            fixVariationVariants(product, modifiedProduct);
        } else {
            delete modifiedProduct.variations;
        }
    }
};

module.exports = {
    fixVariants,
    fixVariationVariants,
    fixVariationAttributes
};

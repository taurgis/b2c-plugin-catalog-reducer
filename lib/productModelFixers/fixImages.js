const toImageNode = image => {
    if (!image) {
        return null;
    }

    if (typeof image === 'string') {
        return {
            $attrs: {
                path: image
            }
        };
    }

    if (image.$attrs && image.$attrs.path) {
        return {
            $attrs: {
                path: image.$attrs.path
            }
        };
    }

    if (image.path) {
        return {
            $attrs: {
                path: image.path
            }
        };
    }

    return null;
};

const hasDefinedValue = value => value !== undefined && value !== null;

const getVariationAttributeId = variation => {
    return variation['attribute-id']
        || (variation.$attrs && variation.$attrs['attribute-id'])
        || null;
};

const getVariationValue = variation => {
    if (hasDefinedValue(variation.value)) {
        return variation.value;
    }

    if (variation.$attrs && hasDefinedValue(variation.$attrs.value)) {
        return variation.$attrs.value;
    }

    return null;
};

const toVariationNode = variation => {
    if (!variation) {
        return null;
    }

    const attrs = {};
    const attributeId = getVariationAttributeId(variation);
    const value = getVariationValue(variation);

    if (attributeId !== null) {
        attrs['attribute-id'] = attributeId;
    }

    if (value !== null) {
        attrs.value = value;
    }

    if (Object.keys(attrs).length === 0) {
        return null;
    }

    return {
        $attrs: attrs
    };
};

module.exports = function fixImages(product, modifiedProduct) {
    if (product.images) {
        if (!Array.isArray(product.images)) {
            product.images = [product.images];
        }

        modifiedProduct.images = {
            'image-group': product.images.map(imageGroup => {
                const modifiedImageGroup = {
                    $attrs: imageGroup.$attrs
                };

                if (imageGroup.variation) {
                    const variationNode = toVariationNode(imageGroup.variation);

                    if (variationNode) {
                        modifiedImageGroup.variation = variationNode;
                    }
                }

                if (Array.isArray(imageGroup.image)) {
                    const mappedImages = imageGroup.image.map(toImageNode).filter(Boolean);

                    if (mappedImages.length) {
                        modifiedImageGroup.image = mappedImages;
                    }
                } else {
                    const mappedImage = toImageNode(imageGroup.image);

                    if (mappedImage) {
                        modifiedImageGroup.image = mappedImage;
                    }
                }

                return modifiedImageGroup;
            })
        };
    }
};

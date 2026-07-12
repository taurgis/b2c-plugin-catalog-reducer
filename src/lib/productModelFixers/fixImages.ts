import {XmlNode} from '../types';

const toImageNode = (image: any): XmlNode | null => {
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

const hasDefinedValue = (value: unknown): boolean => value !== undefined && value !== null;

const getVariationAttributeId = (variation: any): string | null => {
  return variation['attribute-id']
    || (variation.$attrs && variation.$attrs['attribute-id'])
    || null;
};

const getVariationValue = (variation: any): unknown => {
  if (hasDefinedValue(variation.value)) {
    return variation.value;
  }

  if (variation.$attrs && hasDefinedValue(variation.$attrs.value)) {
    return variation.$attrs.value;
  }

  return null;
};

const toVariationNode = (variation: any): XmlNode | null => {
  if (!variation) {
    return null;
  }

  const attrs: Record<string, unknown> = {};
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

export default function fixImages(product: XmlNode, modifiedProduct: XmlNode): void {
  if (product.images) {
    if (!Array.isArray(product.images)) {
      product.images = [product.images];
    }

    modifiedProduct.images = {
      'image-group': product.images.map((imageGroup: any) => {
        const modifiedImageGroup: XmlNode = {
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
}

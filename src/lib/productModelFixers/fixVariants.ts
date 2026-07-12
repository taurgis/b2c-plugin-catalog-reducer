import {extractProductIds} from '../modelNormalization';
import {XmlNode} from '../types';

export const fixVariationVariants = (product: XmlNode, modifiedProduct: XmlNode): void => {
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

export const fixVariationAttributes = (product: XmlNode, modifiedProduct: XmlNode): void => {
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
    (sourceVariationAttribute: any) => {
      const modifiedVariationAttribute = sourceVariationAttribute;

      if (sourceVariationAttribute['variation-attribute-values']) {
        if (!Array.isArray(sourceVariationAttribute['variation-attribute-values'])) {
          modifiedVariationAttribute['variation-attribute-values'] = [sourceVariationAttribute['variation-attribute-values']];
        }

        modifiedVariationAttribute['variation-attribute-values'] = {
          'variation-attribute-value': modifiedVariationAttribute['variation-attribute-values'].map((variationAttributeValue: any) => {
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

export const fixVariants = (product: XmlNode, modifiedProduct: XmlNode): void => {
  if (product.variations) {
    if (product.variations.variants && product.variations.attributes) {
      fixVariationAttributes(product, modifiedProduct);
      fixVariationVariants(product, modifiedProduct);
    } else {
      delete modifiedProduct.variations;
    }
  }
};

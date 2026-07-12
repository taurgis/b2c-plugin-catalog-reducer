import {describe, expect, it} from 'vitest';

import {convertFriendlyConfigToCanonical, FRIENDLY_CONFIG_SCHEMA_MARKER, isFriendlyConfigShape} from './friendlyConfig';

describe('friendlyConfig', () => {
  describe('isFriendlyConfigShape', () => {
    it('is false for the canonical flat shape (no $schema key)', () => {
      expect(isFriendlyConfigShape({total: 20, master: 5, productIds: []})).toBe(false);
    });

    it('is false for an empty config', () => {
      expect(isFriendlyConfigShape({})).toBe(false);
    });

    it('is true whenever a $schema key is present, regardless of its value', () => {
      expect(isFriendlyConfigShape({$schema: FRIENDLY_CONFIG_SCHEMA_MARKER})).toBe(true);
      expect(isFriendlyConfigShape({$schema: 'unknown-value'})).toBe(true);
    });
  });

  describe('convertFriendlyConfigToCanonical', () => {
    it('maps every friendly-shape field to its canonical equivalent', () => {
      const canonical = convertFriendlyConfigToCanonical({
        $schema: FRIENDLY_CONFIG_SCHEMA_MARKER,
        selection: {
          totalProducts: 5000,
          masterProducts: 200,
          productIds: ['100000', 'P10071'],
          attributes: [
            {id: 'Maat', value: '36', count: 50},
            {id: 'Trends', count: 50}
          ]
        },
        sites: {onlineSiteIds: ['MX']},
        pricebook: {randomSeed: 1337, sourceFiles: ['./a.xml']},
        storefront: {sourceFiles: ['./storefront.xml']},
        output: {beautify: false}
      });

      expect(canonical).toEqual({
        total: 5000,
        master: 200,
        productIds: ['100000', 'P10071'],
        attributes: {
          custom: [
            {id: 'Maat', value: '36', count: 50},
            {id: 'Trends', count: 50}
          ]
        },
        onlineSiteIds: ['MX'],
        pricebookRandomSeed: 1337,
        pricebookSourceFiles: ['./a.xml'],
        storefrontSourceFiles: ['./storefront.xml'],
        beautify: false
      });
    });

    it('omits canonical fields whose friendly-shape sections/values are absent', () => {
      const canonical = convertFriendlyConfigToCanonical({
        $schema: FRIENDLY_CONFIG_SCHEMA_MARKER,
        selection: {totalProducts: 20}
      });

      expect(canonical).toEqual({total: 20});
    });

    it('returns an empty canonical config for a minimal friendly-shape config with no sections', () => {
      expect(convertFriendlyConfigToCanonical({$schema: FRIENDLY_CONFIG_SCHEMA_MARKER})).toEqual({});
    });

    it('throws a clear error for an unrecognized $schema value rather than silently falling back', () => {
      expect(() => convertFriendlyConfigToCanonical({$schema: 'catalog-reducer-config@2'})).toThrow(
        /Unsupported config \$schema/
      );
    });
  });
});

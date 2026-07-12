import {describe, expect, it} from 'vitest';

import {
  deriveOutputFilename,
  escapeXmlAttribute,
  getConfiguredSourceFiles,
  serializeXml,
  shouldBeautifyOutput,
  toArray
} from './xmlSerialization';

describe('xmlSerialization helpers', () => {
  it('toArray normalizes arrays, nullish values, and scalars', () => {
    expect(toArray(['a', 'b'])).toEqual(['a', 'b']);
    expect(toArray(undefined)).toEqual([]);
    expect(toArray(null)).toEqual([]);
    expect(toArray('solo')).toEqual(['solo']);
  });

  it('escapeXmlAttribute escapes all reserved XML characters', () => {
    expect(escapeXmlAttribute(`a & b < c > d " e ' f`)).toBe('a &amp; b &lt; c &gt; d &quot; e &apos; f');
  });

  it('deriveOutputFilename falls back to .xml when the output has no extension', () => {
    expect(deriveOutputFilename('/tmp/output', '-inventory')).toBe('/tmp/output-inventory.xml');
    expect(deriveOutputFilename('/tmp/output.xml', '-inventory')).toBe('/tmp/output-inventory.xml');
  });

  it('shouldBeautifyOutput defaults to true unless explicitly disabled', () => {
    expect(shouldBeautifyOutput(undefined)).toBe(true);
    expect(shouldBeautifyOutput({})).toBe(true);
    expect(shouldBeautifyOutput({beautify: false})).toBe(false);
    expect(shouldBeautifyOutput({beautify: true})).toBe(true);
  });

  it('serializeXml returns the raw (unformatted) XML when beautifyOutput is false', async () => {
    const logger = {info: () => {}, warn: () => {}, error: () => {}};
    const xml = await serializeXml({$name: 'catalog', $attrs: {'catalog-id': 'x'}}, false, logger);

    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n/);
    expect(xml).not.toMatch(/\n\s+</);
  });

  it('getConfiguredSourceFiles returns an empty array when unset', () => {
    expect(getConfiguredSourceFiles(null, 'pricebookSourceFiles')).toEqual([]);
    expect(getConfiguredSourceFiles({}, 'pricebookSourceFiles')).toEqual([]);
  });

  it('getConfiguredSourceFiles trims valid entries', () => {
    expect(getConfiguredSourceFiles({pricebookSourceFiles: [' a.xml ', 'b.xml']}, 'pricebookSourceFiles')).toEqual(['a.xml', 'b.xml']);
  });

  it('getConfiguredSourceFiles throws when the configured value is not an array', () => {
    expect(() => getConfiguredSourceFiles({pricebookSourceFiles: 'not-an-array'}, 'pricebookSourceFiles'))
      .toThrow(/must be an array of file paths/);
  });

  it('getConfiguredSourceFiles throws when an entry is not a non-empty string', () => {
    expect(() => getConfiguredSourceFiles({pricebookSourceFiles: ['']}, 'pricebookSourceFiles'))
      .toThrow(/must be a non-empty string/);
    expect(() => getConfiguredSourceFiles({pricebookSourceFiles: [42]}, 'pricebookSourceFiles'))
      .toThrow(/must be a non-empty string/);
  });
});

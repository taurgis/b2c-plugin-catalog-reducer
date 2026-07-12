// Writes filtered storefront catalog XML output(s) derived from configured
// `storefrontSourceFiles`: streams each source file, keeps non-product
// structural XML untouched, and drops `<category-assignment>` elements for
// products that were not selected. Split out of the legacy monolithic
// lib/parser.js.
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

import {Logger, SelectorConfig, XmlNode} from '../types';
import {extractAttributeValueFromOpeningTag} from './catalogId';
import {
  buildSelectedProductIdSet,
  deriveNamedOutputFilename,
  getConfiguredSourceFiles,
  writeXmlChunks
} from './xmlSerialization';

const XML_COMMENT_START_TOKEN = '<!--';
const XML_CDATA_START_TOKEN = '<![CDATA[';
const XML_PROCESSING_INSTRUCTION_START_TOKEN = '<?';
const CATEGORY_ASSIGNMENT_START_TOKEN = '<category-assignment';
const CATEGORY_ASSIGNMENT_END_TOKEN = '</category-assignment>';
const STOREFRONT_FILTER_BUFFER_TAIL_LENGTH = Math.max(
  XML_COMMENT_START_TOKEN.length,
  XML_CDATA_START_TOKEN.length,
  XML_PROCESSING_INSTRUCTION_START_TOKEN.length,
  CATEGORY_ASSIGNMENT_START_TOKEN.length
) - 1;
const XML_CHARACTER_REFERENCE_BUFFER_TAIL_LENGTH = 64;

export const getConfiguredStorefrontSourceFiles = (selectorConfig: SelectorConfig): string[] => getConfiguredSourceFiles(selectorConfig, 'storefrontSourceFiles');

const parseXmlNumericCharacterReference = (hexValue: string | undefined, decimalValue: string): number => {
  if (hexValue !== undefined) {
    return Number.parseInt(hexValue, 16);
  }

  return Number.parseInt(decimalValue, 10);
};

const isXmlHighSurrogate = (codePoint: number): boolean => codePoint >= 0xD800 && codePoint <= 0xDBFF;

const isXmlLowSurrogate = (codePoint: number): boolean => codePoint >= 0xDC00 && codePoint <= 0xDFFF;

const isValidXmlCodePoint = (codePoint: number): boolean => {
  return codePoint === 0x9
    || codePoint === 0xA
    || codePoint === 0xD
    || (codePoint >= 0x20 && codePoint <= 0xD7FF)
    || (codePoint >= 0xE000 && codePoint <= 0xFFFD)
    || (codePoint >= 0x10000 && codePoint <= 0x10FFFF);
};

const toXmlCharacterReference = (codePoint: number): string => `&#x${codePoint.toString(16).toUpperCase()};`;

const normalizeXmlNumericCharacterReferences = (text: string): string => {
  const numericCharacterReferencePattern = /&#(?:x([0-9A-Fa-f]+)|([0-9]+));/g;

  const normalizeSingleReference = (match: string, hexValue: string | undefined, decimalValue: string): string => {
    const codePoint = parseXmlNumericCharacterReference(hexValue, decimalValue);

    if (!Number.isFinite(codePoint)) {
      return match;
    }

    if (!isValidXmlCodePoint(codePoint)) {
      return '&#xFFFD;';
    }

    return match;
  };

  const normalizedSurrogatePairs = text.replace(
    /&#(?:x([0-9A-Fa-f]+)|([0-9]+));&#(?:x([0-9A-Fa-f]+)|([0-9]+));/g,
    (match, firstHexValue, firstDecimalValue, secondHexValue, secondDecimalValue) => {
      const firstCodePoint = parseXmlNumericCharacterReference(firstHexValue, firstDecimalValue);
      const secondCodePoint = parseXmlNumericCharacterReference(secondHexValue, secondDecimalValue);

      if (!Number.isFinite(firstCodePoint) || !Number.isFinite(secondCodePoint)) {
        return match;
      }

      if (isXmlHighSurrogate(firstCodePoint) && isXmlLowSurrogate(secondCodePoint)) {
        const normalizedCodePoint = ((firstCodePoint - 0xD800) << 10)
          + (secondCodePoint - 0xDC00)
          + 0x10000;

        return toXmlCharacterReference(normalizedCodePoint);
      }

      return normalizeSingleReference('', firstHexValue, firstDecimalValue)
        + normalizeSingleReference('', secondHexValue, secondDecimalValue);
    }
  );

  return normalizedSurrogatePairs.replace(numericCharacterReferencePattern, normalizeSingleReference);
};

const sanitizeXmlCharacterReferenceChunks = async function* (chunks: AsyncIterable<string>): AsyncGenerator<string> {
  let buffer = '';

  for await (const chunk of chunks) {
    buffer += chunk;

    if (buffer.length <= XML_CHARACTER_REFERENCE_BUFFER_TAIL_LENGTH) {
      continue;
    }

    const flushLength = buffer.length - XML_CHARACTER_REFERENCE_BUFFER_TAIL_LENGTH;

    yield normalizeXmlNumericCharacterReferences(buffer.slice(0, flushLength));
    buffer = buffer.slice(flushLength);
  }

  if (buffer.length > 0) {
    yield normalizeXmlNumericCharacterReferences(buffer);
  }
};

interface StorefrontToken {
  index: number;
  type: 'comment' | 'cdata' | 'processing-instruction' | 'category-assignment';
}

const findNextStorefrontToken = (buffer: string): StorefrontToken | null => {
  const tokenDescriptors: Array<{token: string; type: StorefrontToken['type']}> = [
    {token: XML_COMMENT_START_TOKEN, type: 'comment'},
    {token: XML_CDATA_START_TOKEN, type: 'cdata'},
    {token: XML_PROCESSING_INSTRUCTION_START_TOKEN, type: 'processing-instruction'},
    {token: CATEGORY_ASSIGNMENT_START_TOKEN, type: 'category-assignment'}
  ];

  let nextToken: StorefrontToken | null = null;

  for (let i = 0; i < tokenDescriptors.length; i++) {
    const descriptor = tokenDescriptors[i];
    const index = buffer.indexOf(descriptor.token);

    if (index === -1) {
      continue;
    }

    if (!nextToken || index < nextToken.index) {
      nextToken = {
        index,
        type: descriptor.type
      };
    }
  }

  return nextToken;
};

const extractDelimitedSection = (buffer: string, endToken: string): {text: string; endIndex: number} | null => {
  const endIndex = buffer.indexOf(endToken);

  if (endIndex === -1) {
    return null;
  }

  return {
    text: buffer.slice(0, endIndex + endToken.length),
    endIndex: endIndex + endToken.length
  };
};

const findTagEndIndex = (buffer: string): number => {
  let quoteCharacter: string | null = null;

  for (let index = 0; index < buffer.length; index++) {
    const character = buffer[index];

    if (quoteCharacter) {
      if (character === quoteCharacter) {
        quoteCharacter = null;
      }

      continue;
    }

    if (character === '"' || character === "'") {
      quoteCharacter = character;
      continue;
    }

    if (character === '>') {
      return index;
    }
  }

  return -1;
};

const extractCategoryAssignmentElement = (buffer: string): {text: string; openingTag: string; endIndex: number} | null => {
  const openingTagEndIndex = findTagEndIndex(buffer);

  if (openingTagEndIndex === -1) {
    return null;
  }

  const openingTag = buffer.slice(0, openingTagEndIndex + 1);

  if (/\/\s*>$/.test(openingTag)) {
    return {
      text: openingTag,
      openingTag,
      endIndex: openingTagEndIndex + 1
    };
  }

  const closingTagIndex = buffer.indexOf(CATEGORY_ASSIGNMENT_END_TOKEN, openingTagEndIndex + 1);

  if (closingTagIndex === -1) {
    return null;
  }

  return {
    text: buffer.slice(0, closingTagIndex + CATEGORY_ASSIGNMENT_END_TOKEN.length),
    openingTag,
    endIndex: closingTagIndex + CATEGORY_ASSIGNMENT_END_TOKEN.length
  };
};

const buildFilteredStorefrontCatalogChunks = async function* (sourceFilePath: string, selectedProductIds: Set<string>): AsyncGenerator<string> {
  const sourceStream = fs.createReadStream(sourceFilePath, {encoding: 'utf8'});
  let buffer = '';

  try {
    for await (const chunk of sourceStream) {
      buffer += chunk;

      while (buffer.length > 0) {
        const nextToken = findNextStorefrontToken(buffer);

        if (!nextToken) {
          if (buffer.length <= STOREFRONT_FILTER_BUFFER_TAIL_LENGTH) {
            break;
          }

          const flushLength = buffer.length - STOREFRONT_FILTER_BUFFER_TAIL_LENGTH;

          yield buffer.slice(0, flushLength);
          buffer = buffer.slice(flushLength);
          break;
        }

        if (nextToken.index > 0) {
          yield buffer.slice(0, nextToken.index);
          buffer = buffer.slice(nextToken.index);
          continue;
        }

        if (nextToken.type === 'comment') {
          const commentSection = extractDelimitedSection(buffer, '-->');

          if (!commentSection) {
            break;
          }

          yield commentSection.text;
          buffer = buffer.slice(commentSection.endIndex);
          continue;
        }

        if (nextToken.type === 'cdata') {
          const cdataSection = extractDelimitedSection(buffer, ']]>');

          if (!cdataSection) {
            break;
          }

          yield cdataSection.text;
          buffer = buffer.slice(cdataSection.endIndex);
          continue;
        }

        if (nextToken.type === 'processing-instruction') {
          const instructionSection = extractDelimitedSection(buffer, '?>');

          if (!instructionSection) {
            break;
          }

          yield instructionSection.text;
          buffer = buffer.slice(instructionSection.endIndex);
          continue;
        }

        const categoryAssignmentElement = extractCategoryAssignmentElement(buffer);

        if (!categoryAssignmentElement) {
          break;
        }

        const productId = extractAttributeValueFromOpeningTag(categoryAssignmentElement.openingTag, 'product-id');

        if (productId && selectedProductIds.has(productId)) {
          yield categoryAssignmentElement.text;
        }

        buffer = buffer.slice(categoryAssignmentElement.endIndex);
      }
    }

    if (buffer.length > 0) {
      yield buffer;
    }
  } catch (error: any) {
    throw new Error(`Unable to process configured storefront source file "${sourceFilePath}": ${error.message}`, {cause: error});
  }
};

const buildStorefrontOutputsFromSourceFiles = async (
  outputFilename: string,
  selectorConfig: SelectorConfig
): Promise<Array<{outputFilename: string; sourceFilePath: string}>> => {
  const sourceFiles = getConfiguredStorefrontSourceFiles(selectorConfig);

  if (sourceFiles.length === 0) {
    return [];
  }

  const sourceNameCounts = new Map<string, number>();
  const outputSelections: Array<{outputFilename: string; sourceFilePath: string}> = [];

  for (let i = 0; i < sourceFiles.length; i++) {
    const sourceFilePath = path.resolve(process.cwd(), sourceFiles[i]);

    try {
      await fsPromises.access(sourceFilePath, fs.constants.R_OK);
    } catch {
      throw new Error(`Configured storefront source file "${sourceFiles[i]}" is not readable.`);
    }

    outputSelections.push({
      outputFilename: deriveNamedOutputFilename(outputFilename, sourceFiles[i], sourceNameCounts, '-storefront-', 'storefront'),
      sourceFilePath
    });
  }

  return outputSelections;
};

export const writeStorefrontXml = async (
  outputFilename: string,
  productSelection: XmlNode[],
  selectorConfig: SelectorConfig,
  logger: Logger
): Promise<void> => {
  const sourceStorefrontOutputs = await buildStorefrontOutputsFromSourceFiles(outputFilename, selectorConfig);

  if (sourceStorefrontOutputs.length === 0) {
    return;
  }

  const selectedProductIds = buildSelectedProductIdSet(productSelection);

  await Promise.all(sourceStorefrontOutputs.map(sourceStorefrontOutput => {
    return writeXmlChunks(
      sourceStorefrontOutput.outputFilename,
      sanitizeXmlCharacterReferenceChunks(
        buildFilteredStorefrontCatalogChunks(sourceStorefrontOutput.sourceFilePath, selectedProductIds)
      )
    );
  }));

  logger.info(`Done writing ${sourceStorefrontOutputs.length} storefront catalog output file${sourceStorefrontOutputs.length === 1 ? '' : 's'}`);
};

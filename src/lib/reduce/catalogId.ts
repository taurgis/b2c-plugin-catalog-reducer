// Detects the `catalog-id` attribute from the opening `<catalog>` tag of the
// source XML by scanning lines rather than fully parsing the file, so this
// can run ahead of (and independently from) the streaming product selection
// pass. Split out of the legacy monolithic lib/parser.js.
import fs from 'node:fs';
import readline from 'node:readline';

import chalk from 'chalk';

import {Logger} from '../types';
import {escapeRegExp} from './xmlSerialization';

const CATALOG_HEADER_SCAN_HINT_LINES = 25;

const stripXmlCommentsFromLine = (line: string, isInsideComment: boolean): {textWithoutComments: string; isInsideComment: boolean} => {
  let remaining = line;
  let insideComment = isInsideComment;
  let textWithoutComments = '';

  while (remaining.length) {
    if (insideComment) {
      const commentEndIndex = remaining.indexOf('-->');

      if (commentEndIndex === -1) {
        return {
          textWithoutComments,
          isInsideComment: true
        };
      }

      remaining = remaining.slice(commentEndIndex + 3);
      insideComment = false;
      continue;
    }

    const commentStartIndex = remaining.indexOf('<!--');

    if (commentStartIndex === -1) {
      textWithoutComments += remaining;
      break;
    }

    textWithoutComments += remaining.slice(0, commentStartIndex);
    remaining = remaining.slice(commentStartIndex + 4);
    insideComment = true;
  }

  return {
    textWithoutComments,
    isInsideComment: insideComment
  };
};

export const extractAttributeValueFromOpeningTag = (openingTag: string, attributeName: string): string | null => {
  const match = openingTag.match(new RegExp(`\\b${escapeRegExp(attributeName)}\\s*=\\s*(['"])(.*?)\\1`, 'i'));

  return match && match[2] ? match[2] : null;
};

const extractCatalogIdFromOpeningTag = (openingTag: string): string | null => extractAttributeValueFromOpeningTag(openingTag, 'catalog-id');

export const determineCatalog = async (inputFilename: string, logger: Logger): Promise<string> => {
  let currentLine = 0;
  let didWarnAboutLongPreamble = false;
  let isCollectingCatalogTag = false;
  let catalogTagBuffer = '';
  let isInsideComment = false;
  const stream = fs.createReadStream(inputFilename, {encoding: 'utf8'});
  const reader = readline.createInterface({
    input: stream,
    crlfDelay: Number.POSITIVE_INFINITY
  });

  try {
    for await (const line of reader) {
      currentLine += 1;
      const {textWithoutComments, isInsideComment: nextIsInsideComment} = stripXmlCommentsFromLine(
        line,
        isInsideComment
      );

      isInsideComment = nextIsInsideComment;

      if (!isCollectingCatalogTag) {
        const catalogMatch = textWithoutComments.match(/<catalog\b/i);
        const catalogStartIndex = catalogMatch ? catalogMatch.index! : -1;

        if (catalogStartIndex === -1) {
          // Most files have <catalog> near the top. If not, keep scanning and emit a warning.
          if (!didWarnAboutLongPreamble && currentLine > CATALOG_HEADER_SCAN_HINT_LINES) {
            didWarnAboutLongPreamble = true;
            logger.warn(
              chalk.yellow(
                `Catalog tag not found in the first ${CATALOG_HEADER_SCAN_HINT_LINES} lines; scanning remainder of file.`
              )
            );
          }

          continue;
        }

        isCollectingCatalogTag = true;
        catalogTagBuffer = textWithoutComments.slice(catalogStartIndex).trim();
      } else {
        const trimmedLine = textWithoutComments.trim();

        if (trimmedLine) {
          catalogTagBuffer += ` ${trimmedLine}`;
        }
      }

      const catalogTagEndIndex = catalogTagBuffer.indexOf('>');

      if (catalogTagEndIndex === -1) {
        continue;
      }

      const openingTag = catalogTagBuffer.slice(0, catalogTagEndIndex + 1);
      const catalogId = extractCatalogIdFromOpeningTag(openingTag);

      if (catalogId) {
        return catalogId;
      }

      throw new Error('Catalog tag found without a catalog-id attribute.');
    }
  } finally {
    reader.close();
    stream.destroy();
  }

  throw new Error('Unable to determine catalog-id from the input XML.');
};

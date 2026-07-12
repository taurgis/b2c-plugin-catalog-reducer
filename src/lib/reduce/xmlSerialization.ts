// Shared XML serialization helpers used by the catalog/inventory/pricebook/
// storefront writer step modules. Split out of the legacy monolithic
// lib/parser.js so each writer module can depend on a small, focused set of
// helpers instead of the entire former parser.js surface.
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

import flow from 'xml-flow';
import format from 'xml-formatter';

import {Logger, SelectorConfig, XmlNode} from '../types';

export const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n';
export const CATALOG_XML_NAMESPACE = 'http://www.demandware.com/xml/impex/catalog/2006-10-31';
export const INVENTORY_XML_NAMESPACE = 'http://www.demandware.com/xml/impex/inventory/2007-05-31';
export const PRICEBOOK_XML_NAMESPACE = 'http://www.demandware.com/xml/impex/pricebook/2006-10-31';
export const INVENTORY_LIST_ID = 'catalog-reducer-inventory';
export const PRICEBOOK_ID = 'catalog-reducer-pricebook';

const DEFAULT_BEAUTIFY_OUTPUT = true;
const XML_FORMATTER_OPTIONS = {collapseContent: true};
const XMLLINT_FORMAT_ARGS = ['--format', '-'];

const XML_ESCAPE_LOOKUP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;'
};

export const toArray = (value: unknown): any[] => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null) {
    return [];
  }

  return [value];
};

export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const escapeXmlAttribute = (value: unknown): string => String(value).replace(/[&<>"']/g, char => XML_ESCAPE_LOOKUP[char]);

export const shouldBeautifyOutput = (selectorConfig: SelectorConfig | null | undefined): boolean => {
  if (!selectorConfig || selectorConfig.beautify === undefined) {
    return DEFAULT_BEAUTIFY_OUTPUT;
  }

  return selectorConfig.beautify !== false;
};

export const deriveOutputFilename = (outputFilename: string, suffix: string): string => {
  const parsed = path.parse(outputFilename);
  const extension = parsed.ext || '.xml';

  return path.join(parsed.dir, `${parsed.name}${suffix}${extension}`);
};

export const deriveNamedOutputFilename = (outputFilename: string, sourceFilePath: string, sourceNameCounts: Map<string, number>, prefix: string, fallbackName: string): string => {
  const sourceBaseName = path.parse(sourceFilePath).name || fallbackName;
  const duplicateCount = sourceNameCounts.get(sourceBaseName) || 0;
  const nextDuplicateCount = duplicateCount + 1;
  const uniqueSourceBaseName = duplicateCount === 0
    ? sourceBaseName
    : `${sourceBaseName}-${nextDuplicateCount}`;

  sourceNameCounts.set(sourceBaseName, nextDuplicateCount);

  return deriveOutputFilename(outputFilename, `${prefix}${uniqueSourceBaseName}`);
};

export const writeXmlChunks = async (outputFilename: string, chunks: AsyncIterable<string> | Iterable<string>): Promise<void> => {
  const xmlChunkStream = Readable.from(chunks);
  const outputStream = fs.createWriteStream(outputFilename, {
    encoding: 'utf8'
  });

  await pipeline(xmlChunkStream, outputStream);
};

export const removeFileIfExists = async (filePath: string): Promise<void> => {
  await fsPromises.rm(filePath, {force: true});
};

const formatXmlWithXmllint = (xml: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const xmllint = spawn('xmllint', XMLLINT_FORMAT_ARGS, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';

    xmllint.stdout.setEncoding('utf8');
    xmllint.stderr.setEncoding('utf8');

    xmllint.stdout.on('data', chunk => {
      stdout += chunk;
    });

    xmllint.stderr.on('data', chunk => {
      stderr += chunk;
    });

    xmllint.on('error', error => {
      reject(new Error(`xmllint invocation failed: ${error.message}`));
    });

    xmllint.on('close', exitCode => {
      if (exitCode === 0) {
        resolve(stdout);
        return;
      }

      const messageSuffix = stderr.trim() ? `: ${stderr.trim()}` : '';
      reject(new Error(`xmllint exited with code ${exitCode}${messageSuffix}`));
    });

    xmllint.stdin.end(xml);
  });
};

export const formatReadableXml = async (xml: string, logger: Logger): Promise<string> => {
  try {
    return await formatXmlWithXmllint(xml);
  } catch (error: any) {
    logger.warn(`xmllint unavailable, falling back to xml-formatter (${error.message})`);
    return format(xml, XML_FORMATTER_OPTIONS);
  }
};

export const serializeXml = async (selection: XmlNode, beautifyOutput: boolean, logger: Logger): Promise<string> => {
  const xml = XML_HEADER + flow.toXml(selection);

  if (!beautifyOutput) {
    return xml;
  }

  return formatReadableXml(xml, logger);
};

export const buildSelectedProductIdSet = (productSelection: XmlNode[]): Set<string> => {
  const selectedProductIds = new Set<string>();

  for (let i = 0; i < productSelection.length; i++) {
    const productId = productSelection[i] && productSelection[i].$attrs
      ? productSelection[i].$attrs['product-id']
      : null;

    if (productId) {
      selectedProductIds.add(productId);
    }
  }

  return selectedProductIds;
};

export const getConfiguredSourceFiles = (selectorConfig: SelectorConfig | null | undefined, propertyName: string): string[] => {
  const sourceFiles = selectorConfig ? selectorConfig[propertyName] : undefined;

  if (sourceFiles === undefined || sourceFiles === null) {
    return [];
  }

  if (!Array.isArray(sourceFiles)) {
    throw new Error(`selectorConfig.${propertyName} must be an array of file paths.`);
  }

  return sourceFiles.map((sourceFilePath, index) => {
    if (typeof sourceFilePath !== 'string' || sourceFilePath.trim() === '') {
      throw new Error(`selectorConfig.${propertyName}[${index}] must be a non-empty string.`);
    }

    return sourceFilePath.trim();
  });
};

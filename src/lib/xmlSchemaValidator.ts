import fsPromises from 'node:fs/promises';
import path from 'node:path';

import {validateXML} from 'xmllint-wasm';

import {SelectorConfig} from './types';

const REQUIRED_SCHEMAS = ['catalog.xsd', 'inventory.xsd', 'pricebook.xsd'];
const PRELOAD_SCHEMAS = ['xml.xsd'];
const WASM_PAGE_BYTES = 64 * 1024;
const MIN_WASM_MEMORY_PAGES = 256;
const MAX_WASM_MEMORY_PAGES = 32768;
const VALIDATION_MEMORY_HEADROOM_MULTIPLIER = 8;

const OUTPUT_SCHEMA_MAPPING = [
  {
    suffix: '',
    schemaName: 'catalog.xsd',
    label: 'catalog'
  },
  {
    suffix: '-inventory',
    schemaName: 'inventory.xsd',
    label: 'inventory'
  },
  {
    suffix: '-pricebook',
    schemaName: 'pricebook.xsd',
    label: 'pricebook'
  }
];

export const deriveOutputFilename = (outputFilename: string, suffix: string): string => {
  const parsed = path.parse(outputFilename);
  const extension = parsed.ext || '.xml';

  return path.join(parsed.dir, `${parsed.name}${suffix}${extension}`);
};

const getConfiguredPricebookSourceFiles = (selectorConfig: SelectorConfig | null): string[] => {
  if (!selectorConfig || !Array.isArray(selectorConfig.pricebookSourceFiles)) {
    return [];
  }

  return selectorConfig.pricebookSourceFiles
    .filter((sourceFilePath: unknown) => typeof sourceFilePath === 'string' && sourceFilePath.trim() !== '')
    .map((sourceFilePath: string) => sourceFilePath.trim());
};

const getConfiguredStorefrontSourceFiles = (selectorConfig: SelectorConfig | null): string[] => {
  if (!selectorConfig || !Array.isArray(selectorConfig.storefrontSourceFiles)) {
    return [];
  }

  return selectorConfig.storefrontSourceFiles
    .filter((sourceFilePath: unknown) => typeof sourceFilePath === 'string' && sourceFilePath.trim() !== '')
    .map((sourceFilePath: string) => sourceFilePath.trim());
};

export const derivePricebookOutputFilenames = (outputFilename: string, selectorConfig: SelectorConfig | null): string[] => {
  const sourceFiles = getConfiguredPricebookSourceFiles(selectorConfig);

  if (sourceFiles.length === 0) {
    return [deriveOutputFilename(outputFilename, '-pricebook')];
  }

  const sourceNameCounts = new Map<string, number>();

  return sourceFiles.map(sourceFilePath => {
    const sourceBaseName = path.parse(sourceFilePath).name || 'pricebook';
    const duplicateCount = sourceNameCounts.get(sourceBaseName) || 0;
    const nextDuplicateCount = duplicateCount + 1;
    const uniqueSourceBaseName = duplicateCount === 0
      ? sourceBaseName
      : `${sourceBaseName}-${nextDuplicateCount}`;

    sourceNameCounts.set(sourceBaseName, nextDuplicateCount);

    return deriveOutputFilename(outputFilename, `-${uniqueSourceBaseName}`);
  });
};

export const deriveStorefrontOutputFilenames = (outputFilename: string, selectorConfig: SelectorConfig | null): string[] => {
  const sourceFiles = getConfiguredStorefrontSourceFiles(selectorConfig);

  if (sourceFiles.length === 0) {
    return [];
  }

  const sourceNameCounts = new Map<string, number>();

  return sourceFiles.map(sourceFilePath => {
    const sourceBaseName = path.parse(sourceFilePath).name || 'storefront';
    const duplicateCount = sourceNameCounts.get(sourceBaseName) || 0;
    const nextDuplicateCount = duplicateCount + 1;
    const uniqueSourceBaseName = duplicateCount === 0
      ? sourceBaseName
      : `${sourceBaseName}-${nextDuplicateCount}`;

    sourceNameCounts.set(sourceBaseName, nextDuplicateCount);

    return deriveOutputFilename(outputFilename, `-storefront-${uniqueSourceBaseName}`);
  });
};

const normalizeSchemaContent = (schemaContent: string): string => schemaContent.replace(/^\uFEFF?\s*/, '');

const resolveDefaultXsdDirectory = (): string => path.resolve(__dirname, '..', '..', 'xsd');

const loadPreloadSchemaContent = async (xsdDirectory: string, schemaName: string): Promise<string> => {
  const bundledXsdDirectory = resolveDefaultXsdDirectory();
  const candidatePaths = [path.join(xsdDirectory, schemaName)];

  if (bundledXsdDirectory !== xsdDirectory) {
    candidatePaths.push(path.join(bundledXsdDirectory, schemaName));
  }

  for (const candidatePath of candidatePaths) {
    try {
      const schemaContent = await fsPromises.readFile(candidatePath, 'utf8');

      return normalizeSchemaContent(schemaContent);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  throw new Error(`Missing XSD preload schema: ${schemaName}`);
};

const prepareSchemasForValidation = async (xsdDirectory: string) => {
  const schemaEntries = await Promise.all(REQUIRED_SCHEMAS.map(async schemaName => {
    const schemaPath = path.join(xsdDirectory, schemaName);
    const schemaContent = await fsPromises.readFile(schemaPath, 'utf8');

    return [schemaName, normalizeSchemaContent(schemaContent)] as const;
  }));

  const preloadEntries = await Promise.all(PRELOAD_SCHEMAS.map(async schemaName => {
    return {
      fileName: schemaName,
      contents: await loadPreloadSchemaContent(xsdDirectory, schemaName)
    };
  }));

  return {
    schemaContents: Object.fromEntries(schemaEntries) as Record<string, string>,
    preloadEntries
  };
};

const calculateValidationMemoryPages = (xmlContent: string, schemaContent: string, preloadEntries: Array<{contents: string}>): number => {
  const totalBytes = Buffer.byteLength(xmlContent, 'utf8')
    + Buffer.byteLength(schemaContent, 'utf8')
    + preloadEntries.reduce((sum, preloadEntry) => sum + Buffer.byteLength(preloadEntry.contents, 'utf8'), 0);
  const estimatedPages = Math.ceil((totalBytes * VALIDATION_MEMORY_HEADROOM_MULTIPLIER) / WASM_PAGE_BYTES);

  return Math.min(MAX_WASM_MEMORY_PAGES, Math.max(MIN_WASM_MEMORY_PAGES, estimatedPages));
};

const validateXmlFileAgainstSchema = async ({xmlPath, schemaName, schemaContents, preloadEntries, label}: {
  xmlPath: string;
  schemaName: string;
  schemaContents: Record<string, string>;
  preloadEntries: Array<{fileName: string; contents: string}>;
  label: string;
}): Promise<void> => {
  const schemaContent = schemaContents[schemaName];

  if (!schemaContent) {
    throw new Error(`Missing XSD schema for ${label} output: ${schemaName}`);
  }

  const xmlContent = await fsPromises.readFile(xmlPath, 'utf8');
  const initialMemoryPages = calculateValidationMemoryPages(xmlContent, schemaContent, preloadEntries);
  const maxMemoryPages = Math.min(MAX_WASM_MEMORY_PAGES, Math.max(initialMemoryPages, initialMemoryPages * 2));

  try {
    const result = await validateXML({
      xml: [{
        fileName: path.basename(xmlPath),
        contents: xmlContent
      }],
      schema: [{
        fileName: schemaName,
        contents: schemaContent
      }],
      preload: preloadEntries,
      initialMemoryPages,
      maxMemoryPages
    });

    if (result.valid) {
      return;
    }

    const details = result.rawOutput
      || result.errors.map(error => error.rawMessage).filter(Boolean).join('\n').trim()
      || 'Unknown XSD validation error';

    throw new Error(details);
  } catch (error: any) {
    throw new Error(`XSD validation failed for ${label} output (${path.basename(xmlPath)}):\n${error.message || 'Unknown validation error'}`, {cause: error});
  }
};

export const validateGeneratedOutputs = async (
  outputFilename: string,
  xsdDirectory: string = resolveDefaultXsdDirectory(),
  selectorConfig: SelectorConfig | null = null
): Promise<void> => {
  const {schemaContents, preloadEntries} = await prepareSchemasForValidation(xsdDirectory);

  await validateXmlFileAgainstSchema({
    xmlPath: deriveOutputFilename(outputFilename, ''),
    schemaName: 'catalog.xsd',
    schemaContents,
    preloadEntries,
    label: 'catalog'
  });

  for (const storefrontXmlPath of deriveStorefrontOutputFilenames(outputFilename, selectorConfig)) {
    await validateXmlFileAgainstSchema({
      xmlPath: storefrontXmlPath,
      schemaName: 'catalog.xsd',
      schemaContents,
      preloadEntries,
      label: 'catalog'
    });
  }

  const inventoryMapping = OUTPUT_SCHEMA_MAPPING.find(item => item.label === 'inventory')!;

  await validateXmlFileAgainstSchema({
    xmlPath: deriveOutputFilename(outputFilename, inventoryMapping.suffix),
    schemaName: inventoryMapping.schemaName,
    schemaContents,
    preloadEntries,
    label: inventoryMapping.label
  });

  for (const xmlPath of derivePricebookOutputFilenames(outputFilename, selectorConfig)) {
    await validateXmlFileAgainstSchema({
      xmlPath,
      schemaName: 'pricebook.xsd',
      schemaContents,
      preloadEntries,
      label: 'pricebook'
    });
  }
};

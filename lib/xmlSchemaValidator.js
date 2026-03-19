const fsPromises = require('fs/promises');
const path = require('path');
const { validateXML } = require('xmllint-wasm');

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

const deriveOutputFilename = (outputFilename, suffix) => {
    const parsed = path.parse(outputFilename);
    const extension = parsed.ext || '.xml';

    return path.join(parsed.dir, `${parsed.name}${suffix}${extension}`);
};

const getConfiguredPricebookSourceFiles = selectorConfig => {
    if (!selectorConfig || !Array.isArray(selectorConfig.pricebookSourceFiles)) {
        return [];
    }

    return selectorConfig.pricebookSourceFiles
        .filter(sourceFilePath => typeof sourceFilePath === 'string' && sourceFilePath.trim() !== '')
        .map(sourceFilePath => sourceFilePath.trim());
};

const getConfiguredStorefrontSourceFiles = selectorConfig => {
    if (!selectorConfig || !Array.isArray(selectorConfig.storefrontSourceFiles)) {
        return [];
    }

    return selectorConfig.storefrontSourceFiles
        .filter(sourceFilePath => typeof sourceFilePath === 'string' && sourceFilePath.trim() !== '')
        .map(sourceFilePath => sourceFilePath.trim());
};

const derivePricebookOutputFilenames = (outputFilename, selectorConfig) => {
    const sourceFiles = getConfiguredPricebookSourceFiles(selectorConfig);

    if (sourceFiles.length === 0) {
        return [deriveOutputFilename(outputFilename, '-pricebook')];
    }

    const sourceNameCounts = new Map();

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

const deriveStorefrontOutputFilenames = (outputFilename, selectorConfig) => {
    const sourceFiles = getConfiguredStorefrontSourceFiles(selectorConfig);

    if (sourceFiles.length === 0) {
        return [];
    }

    const sourceNameCounts = new Map();

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

const normalizeSchemaContent = schemaContent => schemaContent.replace(/^\uFEFF?\s*/, '');

const resolveDefaultXsdDirectory = () => path.resolve(__dirname, '..', 'xsd');

const loadPreloadSchemaContent = async (xsdDirectory, schemaName) => {
    const bundledXsdDirectory = resolveDefaultXsdDirectory();
    const candidatePaths = [path.join(xsdDirectory, schemaName)];

    if (bundledXsdDirectory !== xsdDirectory) {
        candidatePaths.push(path.join(bundledXsdDirectory, schemaName));
    }

    for (const candidatePath of candidatePaths) {
        try {
            const schemaContent = await fsPromises.readFile(candidatePath, 'utf8');

            return normalizeSchemaContent(schemaContent);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    throw new Error(`Missing XSD preload schema: ${schemaName}`);
};

const prepareSchemasForValidation = async xsdDirectory => {
    const schemaEntries = await Promise.all(REQUIRED_SCHEMAS.map(async schemaName => {
        const schemaPath = path.join(xsdDirectory, schemaName);
        const schemaContent = await fsPromises.readFile(schemaPath, 'utf8');

        return [schemaName, normalizeSchemaContent(schemaContent)];
    }));

    const preloadEntries = await Promise.all(PRELOAD_SCHEMAS.map(async schemaName => {
        return {
            fileName: schemaName,
            contents: await loadPreloadSchemaContent(xsdDirectory, schemaName)
        };
    }));

    return {
        schemaContents: Object.fromEntries(schemaEntries),
        preloadEntries
    };
};

const calculateValidationMemoryPages = (xmlContent, schemaContent, preloadEntries) => {
    const totalBytes = Buffer.byteLength(xmlContent, 'utf8')
        + Buffer.byteLength(schemaContent, 'utf8')
        + preloadEntries.reduce((sum, preloadEntry) => sum + Buffer.byteLength(preloadEntry.contents, 'utf8'), 0);
    const estimatedPages = Math.ceil((totalBytes * VALIDATION_MEMORY_HEADROOM_MULTIPLIER) / WASM_PAGE_BYTES);

    return Math.min(MAX_WASM_MEMORY_PAGES, Math.max(MIN_WASM_MEMORY_PAGES, estimatedPages));
};

const validateXmlFileAgainstSchema = async ({ xmlPath, schemaName, schemaContents, preloadEntries, label }) => {
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
    } catch (error) {
        throw new Error(`XSD validation failed for ${label} output (${path.basename(xmlPath)}):\n${error.message || 'Unknown validation error'}`);
    }
};

const validateGeneratedOutputs = async (outputFilename, xsdDirectory = resolveDefaultXsdDirectory(), selectorConfig = null) => {
    const { schemaContents, preloadEntries } = await prepareSchemasForValidation(xsdDirectory);

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

    const inventoryMapping = OUTPUT_SCHEMA_MAPPING.find(item => item.label === 'inventory');

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

module.exports = {
    validateGeneratedOutputs,
    deriveOutputFilename,
    derivePricebookOutputFilenames,
    deriveStorefrontOutputFilenames
};

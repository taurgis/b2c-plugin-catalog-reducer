const fsPromises = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const REQUIRED_SCHEMAS = ['catalog.xsd', 'inventory.xsd', 'pricebook.xsd'];

const XML_NAMESPACE_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema
    xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:xml="http://www.w3.org/XML/1998/namespace"
    targetNamespace="http://www.w3.org/XML/1998/namespace"
    elementFormDefault="qualified"
    attributeFormDefault="unqualified">
    <xsd:attribute name="lang" type="xsd:language" />
</xsd:schema>
`;

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

const normalizeSchemaContent = schemaContent => schemaContent.replace(/^\uFEFF?\s*/, '');

const ensureXmllintAvailable = async () => {
    try {
        await execFileAsync('xmllint', ['--version']);
    } catch (error) {
        throw new Error(
            'XML Schema validation requires "xmllint" (libxml2). '
            + 'Install it and ensure it is available on your PATH.'
        );
    }
};

const prepareSchemasForValidation = async xsdDirectory => {
    const tempDirectory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-xsd-'));

    const schemaPaths = {};

    await Promise.all(REQUIRED_SCHEMAS.map(async schemaName => {
        const sourcePath = path.join(xsdDirectory, schemaName);
        const targetPath = path.join(tempDirectory, schemaName);
        const schemaContent = await fsPromises.readFile(sourcePath, 'utf8');

        await fsPromises.writeFile(targetPath, normalizeSchemaContent(schemaContent), 'utf8');
        schemaPaths[schemaName] = targetPath;
    }));

    await fsPromises.writeFile(path.join(tempDirectory, 'xml.xsd'), XML_NAMESPACE_XSD, 'utf8');

    return {
        tempDirectory,
        schemaPaths
    };
};

const validateXmlFileAgainstSchema = async ({ xmlPath, schemaPath, label }) => {
    try {
        await execFileAsync('xmllint', ['--noout', '--schema', schemaPath, xmlPath], {
            encoding: 'utf8'
        });
    } catch (error) {
        const stdioOutput = [error.stderr, error.stdout]
            .filter(Boolean)
            .join('\n')
            .trim();

        const details = stdioOutput || error.message || 'Unknown xmllint error';

        throw new Error(`XSD validation failed for ${label} output (${path.basename(xmlPath)}):\n${details}`);
    }
};

const resolveDefaultXsdDirectory = () => path.resolve(__dirname, '..', 'xsd');

const validateGeneratedOutputs = async (outputFilename, xsdDirectory = resolveDefaultXsdDirectory(), selectorConfig = null) => {
    await ensureXmllintAvailable();
    const { tempDirectory, schemaPaths } = await prepareSchemasForValidation(xsdDirectory);

    try {
        for (const mapping of OUTPUT_SCHEMA_MAPPING.filter(item => item.label !== 'pricebook')) {
            const xmlPath = deriveOutputFilename(outputFilename, mapping.suffix);
            const schemaPath = schemaPaths[mapping.schemaName];

            await validateXmlFileAgainstSchema({
                xmlPath,
                schemaPath,
                label: mapping.label
            });
        }

        for (const xmlPath of derivePricebookOutputFilenames(outputFilename, selectorConfig)) {
            await validateXmlFileAgainstSchema({
                xmlPath,
                schemaPath: schemaPaths['pricebook.xsd'],
                label: 'pricebook'
            });
        }
    } finally {
        await fsPromises.rm(tempDirectory, { recursive: true, force: true });
    }
};

module.exports = {
    validateGeneratedOutputs,
    deriveOutputFilename,
    derivePricebookOutputFilenames
};

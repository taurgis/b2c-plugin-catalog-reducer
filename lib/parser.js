const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const readline = require('readline');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { spawn } = require('child_process');
const flow = require('xml-flow');
const format = require('xml-formatter');
const chalk = require('chalk');
const { normalizeRuntimeOptions } = require('./runtimeSupport');
const { selectProducts } = require('./selectionPipeline');

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n';
const CATALOG_HEADER_SCAN_HINT_LINES = 25;
const DEFAULT_BEAUTIFY_OUTPUT = true;
const CATALOG_XML_NAMESPACE = 'http://www.demandware.com/xml/impex/catalog/2006-10-31';
const INVENTORY_XML_NAMESPACE = 'http://www.demandware.com/xml/impex/inventory/2007-05-31';
const PRICEBOOK_XML_NAMESPACE = 'http://www.demandware.com/xml/impex/pricebook/2006-10-31';
const INVENTORY_LIST_ID = 'catalog-reducer-inventory';
const PRICEBOOK_ID = 'catalog-reducer-pricebook';
const XML_ESCAPE_LOOKUP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
};
const XML_FORMATTER_OPTIONS = {
    collapseContent: true
};
const XMLLINT_FORMAT_ARGS = ['--format', '-'];

const buildSelection = (catalogId, products) => ({
    $name: 'catalog',
    product: products,
    $attrs: {
        xmlns: CATALOG_XML_NAMESPACE,
        'catalog-id': catalogId
    }
});

const toArray = value => {
    if (Array.isArray(value)) {
        return value;
    }

    if (value === undefined || value === null) {
        return [];
    }

    return [value];
};

const escapeXmlAttribute = value => String(value).replace(/[&<>"']/g, char => XML_ESCAPE_LOOKUP[char]);

const writeXmlChunks = async (outputFilename, chunks) => {
    const xmlChunkStream = Readable.from(chunks);
    const outputStream = fs.createWriteStream(outputFilename, {
        encoding: 'utf8'
    });

    await pipeline(xmlChunkStream, outputStream);
};

const removeFileIfExists = async filePath => {
    await fsPromises.rm(filePath, { force: true });
};

const buildCompactCatalogChunks = function* (catalogId, selectedProducts) {
    yield XML_HEADER;
    yield `<catalog xmlns="${CATALOG_XML_NAMESPACE}" catalog-id="${escapeXmlAttribute(catalogId)}">`;

    for (let i = 0; i < selectedProducts.length; i++) {
        yield flow.toXml({
            product: selectedProducts[i]
        });
    }

    yield '</catalog>';
};

const buildCompactInventoryChunks = function* (productSelection) {
    yield XML_HEADER;
    yield `<inventory xmlns="${INVENTORY_XML_NAMESPACE}">`;
    yield `<inventory-list><header list-id="${INVENTORY_LIST_ID}">`;
    yield '<default-instock>false</default-instock>';
    yield '<use-bundle-inventory-only>false</use-bundle-inventory-only>';
    yield '<on-order>false</on-order></header><records>';

    for (let i = 0; i < productSelection.length; i++) {
        const productId = productSelection[i].$attrs['product-id'];
        const escapedProductId = escapeXmlAttribute(productId);

        yield `<record product-id="${escapedProductId}"><allocation>99999</allocation></record>`;
    }

    yield '</records></inventory-list></inventory>';
};

const buildCompactPricebookChunks = function* (productSelection, generatePricebookAmount) {
    yield XML_HEADER;
    yield `<pricebooks xmlns="${PRICEBOOK_XML_NAMESPACE}"><pricebook><header pricebook-id="${PRICEBOOK_ID}">`;
    yield '<currency>EUR</currency>';
    yield `<display-name>${PRICEBOOK_ID}</display-name>`;
    yield '<online-flag>true</online-flag></header><price-tables>';

    for (let i = 0; i < productSelection.length; i++) {
        const productId = productSelection[i].$attrs['product-id'];
        const escapedProductId = escapeXmlAttribute(productId);
        const amount = generatePricebookAmount();

        yield `<price-table product-id="${escapedProductId}"><amount quantity="1">${amount}</amount></price-table>`;
    }

    yield '</price-tables></pricebook></pricebooks>';
};

const shouldBeautifyOutput = selectorConfig => {
    if (!selectorConfig || selectorConfig.beautify === undefined) {
        return DEFAULT_BEAUTIFY_OUTPUT;
    }

    return selectorConfig.beautify !== false;
};

const deriveOutputFilename = (outputFilename, suffix) => {
    const parsed = path.parse(outputFilename);
    const extension = parsed.ext || '.xml';

    return path.join(parsed.dir, `${parsed.name}${suffix}${extension}`);
};

const deriveSourcePricebookOutputFilename = (outputFilename, sourceFilePath, sourceNameCounts) => {
    const sourceBaseName = path.parse(sourceFilePath).name || 'pricebook';
    const duplicateCount = sourceNameCounts.get(sourceBaseName) || 0;
    const nextDuplicateCount = duplicateCount + 1;
    const uniqueSourceBaseName = duplicateCount === 0
        ? sourceBaseName
        : `${sourceBaseName}-${nextDuplicateCount}`;

    sourceNameCounts.set(sourceBaseName, nextDuplicateCount);

    return deriveOutputFilename(outputFilename, `-${uniqueSourceBaseName}`);
};

const stripXmlCommentsFromLine = (line, isInsideComment) => {
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

const extractCatalogIdFromOpeningTag = openingTag => {
    const match = openingTag.match(/\bcatalog-id\s*=\s*(['"])(.*?)\1/i);

    return match && match[2] ? match[2] : null;
};

const determineCatalog = async (inputFilename, logger) => {
    let currentLine = 0;
    let didWarnAboutLongPreamble = false;
    let isCollectingCatalogTag = false;
    let catalogTagBuffer = '';
    let isInsideComment = false;
    const stream = fs.createReadStream(inputFilename, { encoding: 'utf8' });
    const reader = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });

    try {
        for await (const line of reader) {
            currentLine += 1;
            const { textWithoutComments, isInsideComment: nextIsInsideComment } = stripXmlCommentsFromLine(
                line,
                isInsideComment
            );

            isInsideComment = nextIsInsideComment;

            if (!isCollectingCatalogTag) {
                const catalogMatch = textWithoutComments.match(/<catalog\b/i);
                const catalogStartIndex = catalogMatch ? catalogMatch.index : -1;

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

const formatXmlWithXmllint = xml => {
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

const formatReadableXml = async (xml, logger) => {
    try {
        return await formatXmlWithXmllint(xml);
    } catch (error) {
        logger.warn(chalk.yellow(`xmllint unavailable, falling back to xml-formatter (${error.message})`));
        return format(xml, XML_FORMATTER_OPTIONS);
    }
};

const serializeXml = async (selection, beautifyOutput, logger) => {
    const xml = XML_HEADER + flow.toXml(selection);

    if (!beautifyOutput) {
        return xml;
    }

    return formatReadableXml(xml, logger);
};

const writeXML = async (outputFilename, catalogSelection, beautifyOutput, logger) => {
    if (!beautifyOutput) {
        await writeXmlChunks(
            outputFilename,
            buildCompactCatalogChunks(catalogSelection.$attrs['catalog-id'], catalogSelection.product)
        );
        logger.info('Done writing output file');
        return;
    }

    const xml = await serializeXml(catalogSelection, beautifyOutput, logger);

    await fsPromises.writeFile(outputFilename, xml, 'utf8');
    logger.info('Done writing output file');
};

const buildInventoryList = productSelection => {
    const inventoryList = {
        $name: 'inventory',
        $attrs: {
            xmlns: INVENTORY_XML_NAMESPACE
        },
        'inventory-list': {
            header: {
                $attrs: {
                    'list-id': INVENTORY_LIST_ID
                },
                'default-instock': 'false',
                'use-bundle-inventory-only': 'false',
                'on-order': 'false'
            },
            records: {
                record: []
            }
        }
    };

    for (let i = 0; i < productSelection.length; i++) {
        const productId = productSelection[i].$attrs['product-id'];

        inventoryList['inventory-list'].records.record.push({
            $attrs: {
                'product-id': productId
            },
            allocation: 99999
        });
    }

    return inventoryList;
};

const normalizeSeed = seedValue => {
    const maxSeed = 2147483647;
    const numericSeed = Number(seedValue);

    if (Number.isFinite(numericSeed)) {
        const normalizedNumericSeed = Math.abs(Math.trunc(numericSeed)) % maxSeed;

        return normalizedNumericSeed || 1;
    }

    const seedText = String(seedValue);
    let hashedSeed = 0;

    for (let i = 0; i < seedText.length; i++) {
        hashedSeed = ((hashedSeed * 31) + seedText.charCodeAt(i)) % maxSeed;
    }

    return hashedSeed || 1;
};

const createSeededRandomGenerator = seedValue => {
    const maxSeed = 2147483647;
    let seed = normalizeSeed(seedValue);

    return () => {
        seed = (seed * 48271) % maxSeed;

        return (seed - 1) / (maxSeed - 1);
    };
};

const createPricebookAmountGenerator = selectorConfig => {
    const seed = selectorConfig ? selectorConfig.pricebookRandomSeed : undefined;

    if (seed === null || seed === undefined || seed === '') {
        // Price amounts are intentionally randomized to create representative sample pricebooks.
        return () => ((Math.random() * 100) + 1).toFixed(2);
    }

    const seededRandom = createSeededRandomGenerator(seed);

    return () => ((seededRandom() * 100) + 1).toFixed(2);
};

const getConfiguredPricebookSourceFiles = selectorConfig => {
    const sourceFiles = selectorConfig ? selectorConfig.pricebookSourceFiles : undefined;

    if (sourceFiles === undefined || sourceFiles === null) {
        return [];
    }

    if (!Array.isArray(sourceFiles)) {
        throw new Error('selectorConfig.pricebookSourceFiles must be an array of file paths.');
    }

    return sourceFiles.map((sourceFilePath, index) => {
        if (typeof sourceFilePath !== 'string' || sourceFilePath.trim() === '') {
            throw new Error(`selectorConfig.pricebookSourceFiles[${index}] must be a non-empty string.`);
        }

        return sourceFilePath.trim();
    });
};

const buildSelectedProductIdSet = productSelection => {
    const selectedProductIds = new Set();

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

const extractPriceTables = pricebook => {
    const priceTablesNode = pricebook['price-tables'];

    if (!priceTablesNode) {
        return [];
    }

    if (Array.isArray(priceTablesNode)) {
        return priceTablesNode;
    }

    if (Array.isArray(priceTablesNode['price-table'])) {
        return priceTablesNode['price-table'];
    }

    if (priceTablesNode['price-table']) {
        return [priceTablesNode['price-table']];
    }

    if (priceTablesNode.$attrs && priceTablesNode.$attrs['product-id']) {
        return [priceTablesNode];
    }

    return [];
};

const filterPricebookTablesBySelectedProductIds = (pricebook, selectedProductIds) => {
    const priceTables = extractPriceTables(pricebook);

    if (priceTables.length === 0) {
        return pricebook;
    }

    const filteredPriceTables = toArray(priceTables).filter(priceTable => {
        const productId = priceTable && priceTable.$attrs ? priceTable.$attrs['product-id'] : null;

        return productId && selectedProductIds.has(productId);
    });

    if (filteredPriceTables.length === 0) {
        delete pricebook['price-tables'];
        return pricebook;
    }

    pricebook['price-tables'] = {
        'price-table': filteredPriceTables
    };

    return pricebook;
};

const iterateSourcePricebooks = async function* (sourceFilePath) {
    const stream = fs.createReadStream(sourceFilePath, { encoding: 'utf8' });
    const sourceParser = flow(stream);
    const queue = [];
    let settled = false;
    let pendingResolve = null;
    let pendingError = null;

    const wake = () => {
        if (typeof pendingResolve === 'function') {
            const resolve = pendingResolve;

            pendingResolve = null;
            resolve();
        }
    };

    const finish = error => {
        if (settled) {
            return;
        }

        settled = true;
        pendingError = error || null;
        wake();
    };

    stream.on('error', error => {
        finish(new Error(`Unable to read configured pricebook source file "${sourceFilePath}": ${error.message}`));
    });

    sourceParser.on('error', error => {
        finish(new Error(`Unable to parse configured pricebook source file "${sourceFilePath}": ${error.message}`));
    });

    sourceParser.on('tag:pricebook', pricebook => {
        queue.push(pricebook);

        if (!settled && !stream.destroyed) {
            stream.pause();
        }

        wake();
    });

    sourceParser.on('end', () => {
        finish();
    });

    try {
        while (!settled || queue.length) {
            if (!queue.length) {
                await new Promise(resolve => {
                    pendingResolve = resolve;
                });
            }

            if (pendingError) {
                throw pendingError;
            }

            while (queue.length) {
                const pricebook = queue.shift();

                yield pricebook;

                if (!settled && !stream.destroyed && stream.isPaused()) {
                    stream.resume();
                }
            }
        }
    } finally {
        if (!stream.destroyed) {
            stream.destroy();
        }

        sourceParser.removeAllListeners('error');
        sourceParser.removeAllListeners('tag:pricebook');
        sourceParser.removeAllListeners('end');
    }
};

const collectFilteredPricebooksFromSourceFile = async (sourceFilePath, selectedProductIds) => {
    const filteredPricebooks = [];

    for await (const pricebook of iterateSourcePricebooks(sourceFilePath)) {
        filteredPricebooks.push(filterPricebookTablesBySelectedProductIds(pricebook, selectedProductIds));
    }

    return filteredPricebooks;
};

const buildCompactSourcePricebookChunks = async function* (sourceFilePath, selectedProductIds) {
    yield XML_HEADER;
    yield `<pricebooks xmlns="${PRICEBOOK_XML_NAMESPACE}">`;

    for await (const pricebook of iterateSourcePricebooks(sourceFilePath)) {
        yield flow.toXml({
            pricebook: filterPricebookTablesBySelectedProductIds(pricebook, selectedProductIds)
        });
    }

    yield '</pricebooks>';
};

const buildPricebookSelection = pricebooks => {
    const selection = {
        $name: 'pricebooks',
        $attrs: {
            xmlns: PRICEBOOK_XML_NAMESPACE
        }
    };

    if (pricebooks.length > 0) {
        selection.pricebook = pricebooks;
    }

    return selection;
};

const buildPricebookOutputsFromSourceFiles = async (outputFilename, selectorConfig) => {
    const sourceFiles = getConfiguredPricebookSourceFiles(selectorConfig);

    if (sourceFiles.length === 0) {
        return [];
    }

    const sourceNameCounts = new Map();
    const outputSelections = [];

    for (let i = 0; i < sourceFiles.length; i++) {
        const sourceFilePath = path.resolve(process.cwd(), sourceFiles[i]);

        try {
            await fsPromises.access(sourceFilePath, fs.constants.R_OK);
        } catch (error) {
            throw new Error(`Configured pricebook source file "${sourceFiles[i]}" is not readable.`);
        }

        outputSelections.push({
            outputFilename: deriveSourcePricebookOutputFilename(outputFilename, sourceFiles[i], sourceNameCounts),
            sourceFilePath
        });
    }

    return outputSelections;
};

const buildPricebook = (productSelection, generatePricebookAmount) => {
    const pricebook = {
        $name: 'pricebooks',
        $attrs: {
            xmlns: PRICEBOOK_XML_NAMESPACE
        },
        pricebook: {
            header: {
                $attrs: {
                    'pricebook-id': PRICEBOOK_ID
                },
                currency: 'EUR',
                'display-name': PRICEBOOK_ID,
                'online-flag': 'true'
            },
            'price-tables': {
                'price-table': []
            }
        }
    };

    for (let i = 0; i < productSelection.length; i++) {
        const productId = productSelection[i].$attrs['product-id'];

        pricebook.pricebook['price-tables']['price-table'].push({
            $attrs: {
                'product-id': productId
            },
            amount: {
                $attrs: {
                    quantity: 1
                },
                $text: generatePricebookAmount()
            }
        });
    }

    return pricebook;
};

const writeStockXML = async (outputFilename, productSelection, beautifyOutput, logger) => {
    if (!beautifyOutput) {
        await writeXmlChunks(outputFilename, buildCompactInventoryChunks(productSelection));
        logger.info('Done writing inventory output file');
        return;
    }

    const inventoryXML = await serializeXml(buildInventoryList(productSelection), beautifyOutput, logger);

    await fsPromises.writeFile(outputFilename, inventoryXML, 'utf8');
    logger.info('Done writing inventory output file');
};

const writePricebookXML = async (outputFilename, productSelection, selectorConfig, beautifyOutput, logger) => {
    const sourcePricebookOutputs = await buildPricebookOutputsFromSourceFiles(outputFilename, selectorConfig);
    const defaultPricebookOutputFilename = deriveOutputFilename(outputFilename, '-pricebook');

    if (sourcePricebookOutputs.length > 0) {
        const selectedProductIds = buildSelectedProductIdSet(productSelection);

        await removeFileIfExists(defaultPricebookOutputFilename);

        await Promise.all(sourcePricebookOutputs.map(async sourcePricebookOutput => {
            if (!beautifyOutput) {
                await writeXmlChunks(
                    sourcePricebookOutput.outputFilename,
                    buildCompactSourcePricebookChunks(sourcePricebookOutput.sourceFilePath, selectedProductIds)
                );
                return;
            }

            const filteredPricebooks = await collectFilteredPricebooksFromSourceFile(
                sourcePricebookOutput.sourceFilePath,
                selectedProductIds
            );
            const sourcePricebookXml = await serializeXml(
                buildPricebookSelection(filteredPricebooks),
                beautifyOutput,
                logger
            );

            await fsPromises.writeFile(sourcePricebookOutput.outputFilename, sourcePricebookXml, 'utf8');
        }));

        logger.info(`Done writing ${sourcePricebookOutputs.length} pricebook output files`);
        return;
    }

    const generatePricebookAmount = createPricebookAmountGenerator(selectorConfig);

    if (!beautifyOutput) {
        await writeXmlChunks(defaultPricebookOutputFilename, buildCompactPricebookChunks(productSelection, generatePricebookAmount));
        logger.info('Done writing pricebook output file');
        return;
    }

    const pricebookXML = await serializeXml(buildPricebook(productSelection, generatePricebookAmount), beautifyOutput, logger);

    await fsPromises.writeFile(defaultPricebookOutputFilename, pricebookXML, 'utf8');
    logger.info('Done writing pricebook output file');
};

const writeDerivedOutputs = async (outputFilename, selectedProducts, selectorConfig, beautifyOutput, logger) => {
    const inventoryOutputFilename = deriveOutputFilename(outputFilename, '-inventory');

    logger.info(chalk.yellow('Writing inventory and pricebook files'));

    await Promise.all([
        writeStockXML(inventoryOutputFilename, selectedProducts, beautifyOutput, logger),
        writePricebookXML(outputFilename, selectedProducts, selectorConfig, beautifyOutput, logger)
    ]);
};


/**
 * Parses the input file, applies selectors and writes to the
 * output file
 */
exports.parse = async function (inputFilename, outputFilename, selectorConfig, runtimeOptions) {
    const runtime = normalizeRuntimeOptions(runtimeOptions);
    const { logger } = runtime;
    const catalogId = await determineCatalog(inputFilename, logger);
    const beautifyOutput = shouldBeautifyOutput(selectorConfig);
    const selectedProducts = await selectProducts(inputFilename, selectorConfig, runtime);

    const selection = buildSelection(catalogId, selectedProducts);

    logger.info(chalk.yellow('Writing catalog file'));
    await writeXML(outputFilename, selection, beautifyOutput, logger);
    await writeDerivedOutputs(outputFilename, selectedProducts, selectorConfig, beautifyOutput, logger);
};

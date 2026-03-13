#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const process = require('process');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const { openProductStream } = require('../lib/productXmlStream');

const resolveCliPath = inputPath => path.resolve(process.cwd(), inputPath);

const parseArguments = () => {
    return yargs(hideBin(process.argv))
        .option('source', {
            alias: 's',
            type: 'string',
            demandOption: true,
            description: 'Source catalog XML file'
        })
        .option('catalog', {
            alias: 'c',
            type: 'string',
            demandOption: true,
            description: 'Filtered catalog XML file'
        })
        .option('inventory', {
            alias: 'i',
            type: 'string',
            demandOption: true,
            description: 'Filtered inventory XML file'
        })
        .option('pricebook', {
            alias: 'p',
            type: 'string',
            demandOption: true,
            description: 'Filtered pricebook XML file'
        })
        .option('strict-set-equality', {
            type: 'boolean',
            default: true,
            description: 'Require inventory and pricebook ID sets to exactly match catalog IDs'
        })
        .option('json', {
            type: 'boolean',
            default: false,
            description: 'Print JSON report to stdout'
        })
        .option('report', {
            type: 'string',
            description: 'Optional path to write JSON report file'
        })
        .option('max-examples', {
            type: 'number',
            default: 10,
            description: 'Maximum examples to include per finding category'
        })
        .strict()
        .help()
        .parse();
};

const mapIncrement = (map, key) => {
    map.set(key, (map.get(key) || 0) + 1);
};

const setDifference = (left, right) => {
    const out = [];

    for (const value of left) {
        if (!right.has(value)) {
            out.push(value);
        }
    }

    return out;
};

const isPrimitive = value => value === null || ['string', 'number', 'boolean'].includes(typeof value);

const collectLeafValues = (value, bag) => {
    if (isPrimitive(value)) {
        bag.push(String(value));
        return;
    }

    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            collectLeafValues(value[i], bag);
        }

        return;
    }

    if (value && typeof value === 'object') {
        const keys = Object.keys(value);

        for (let i = 0; i < keys.length; i++) {
            collectLeafValues(value[keys[i]], bag);
        }
    }
};

const toCountMap = values => {
    const map = new Map();

    for (let i = 0; i < values.length; i++) {
        mapIncrement(map, values[i]);
    }

    return map;
};

const mapCountDiff = (leftMap, rightMap) => {
    const out = [];

    for (const [key, leftCount] of leftMap.entries()) {
        const rightCount = rightMap.get(key) || 0;

        if (leftCount > rightCount) {
            out.push({
                key,
                count: leftCount - rightCount
            });
        }
    }

    out.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    return out;
};

const compareLeafValueMultiset = (sourceProduct, filteredProduct, maxExamples) => {
    const sourceValues = [];
    const filteredValues = [];

    collectLeafValues(sourceProduct, sourceValues);
    collectLeafValues(filteredProduct, filteredValues);

    const sourceCounts = toCountMap(sourceValues);
    const filteredCounts = toCountMap(filteredValues);
    const missing = mapCountDiff(sourceCounts, filteredCounts);
    const extra = mapCountDiff(filteredCounts, sourceCounts);

    const missingTotal = missing.reduce((sum, entry) => sum + entry.count, 0);
    const extraTotal = extra.reduce((sum, entry) => sum + entry.count, 0);

    return {
        sourceLeafCount: sourceValues.length,
        filteredLeafCount: filteredValues.length,
        missingTotal,
        extraTotal,
        missingExamples: missing.slice(0, maxExamples),
        extraExamples: extra.slice(0, maxExamples)
    };
};

const collectShapeTokens = (value, currentPath, bag) => {
    if (isPrimitive(value)) {
        mapIncrement(bag, `${currentPath}#leaf`);
        return;
    }

    if (Array.isArray(value)) {
        mapIncrement(bag, `${currentPath}#array`);

        for (let i = 0; i < value.length; i++) {
            collectShapeTokens(value[i], `${currentPath}[]`, bag);
        }

        return;
    }

    if (!value || typeof value !== 'object') {
        return;
    }

    mapIncrement(bag, `${currentPath}#object`);

    if (value.$attrs && typeof value.$attrs === 'object') {
        const attrNames = Object.keys(value.$attrs);

        for (let i = 0; i < attrNames.length; i++) {
            const attrName = attrNames[i];
            mapIncrement(bag, `${currentPath}@${attrName}`);

            if (isPrimitive(value.$attrs[attrName])) {
                mapIncrement(bag, `${currentPath}@${attrName}#value`);
            }
        }
    }

    const childKeys = Object.keys(value);

    for (let i = 0; i < childKeys.length; i++) {
        const childKey = childKeys[i];

        if (childKey === '$attrs') {
            continue;
        }

        collectShapeTokens(value[childKey], `${currentPath}/${childKey}`, bag);
    }
};

const compareShapeTokens = (sourceProduct, filteredProduct, maxExamples) => {
    const sourceBag = new Map();
    const filteredBag = new Map();

    collectShapeTokens(sourceProduct, 'product', sourceBag);
    collectShapeTokens(filteredProduct, 'product', filteredBag);

    const missing = mapCountDiff(sourceBag, filteredBag);
    const extra = mapCountDiff(filteredBag, sourceBag);

    return {
        missingTotal: missing.reduce((sum, entry) => sum + entry.count, 0),
        extraTotal: extra.reduce((sum, entry) => sum + entry.count, 0),
        missingExamples: missing.slice(0, maxExamples),
        extraExamples: extra.slice(0, maxExamples)
    };
};

const collectProducts = filePath => {
    return new Promise((resolve, reject) => {
        const productById = new Map();
        const duplicateIds = new Set();
        const allIds = new Set();
        const { stream, xml } = openProductStream(filePath);
        let settled = false;

        const finish = error => {
            if (settled) {
                return;
            }

            settled = true;

            if (!stream.destroyed) {
                stream.destroy();
            }

            xml.removeAllListeners('tag:product');
            xml.removeAllListeners('error');
            xml.removeAllListeners('end');

            if (error) {
                reject(error);
                return;
            }

            resolve({
                productById,
                allIds,
                duplicateIds
            });
        };

        xml.on('tag:product', product => {
            const productId = product && product.$attrs ? product.$attrs['product-id'] : null;

            if (!productId) {
                return;
            }

            if (allIds.has(productId)) {
                duplicateIds.add(productId);
            }

            allIds.add(productId);

            if (!productById.has(productId)) {
                productById.set(productId, product);
            }
        });

        xml.on('error', finish);
        xml.on('end', () => finish());
    });
};

const collectSourceIdsAndSelectedProducts = (filePath, selectedIds) => {
    return new Promise((resolve, reject) => {
        const allIds = new Set();
        const duplicateIds = new Set();
        const selectedProductById = new Map();
        const { stream, xml } = openProductStream(filePath);
        let settled = false;

        const finish = error => {
            if (settled) {
                return;
            }

            settled = true;

            if (!stream.destroyed) {
                stream.destroy();
            }

            xml.removeAllListeners('tag:product');
            xml.removeAllListeners('error');
            xml.removeAllListeners('end');

            if (error) {
                reject(error);
                return;
            }

            resolve({
                allIds,
                duplicateIds,
                selectedProductById
            });
        };

        xml.on('tag:product', product => {
            const productId = product && product.$attrs ? product.$attrs['product-id'] : null;

            if (!productId) {
                return;
            }

            if (allIds.has(productId)) {
                duplicateIds.add(productId);
            }

            allIds.add(productId);

            if (selectedIds.has(productId) && !selectedProductById.has(productId)) {
                selectedProductById.set(productId, product);
            }
        });

        xml.on('error', finish);
        xml.on('end', () => finish());
    });
};

const collectIdsFromRegex = (filePath, regex) => {
    const xml = fs.readFileSync(filePath, 'utf8');
    const ids = [];
    let match;

    while ((match = regex.exec(xml)) !== null) {
        ids.push(match[1]);
    }

    const seen = new Set();
    const duplicateIds = new Set();

    for (let i = 0; i < ids.length; i++) {
        const productId = ids[i];

        if (seen.has(productId)) {
            duplicateIds.add(productId);
        }

        seen.add(productId);
    }

    return {
        ids: seen,
        duplicateIds,
        totalRecords: ids.length,
        xml
    };
};

const countRegexMatches = (text, regex) => {
    const matches = text.match(regex);
    return matches ? matches.length : 0;
};

const summarizeExamples = (values, maxExamples) => values.slice(0, maxExamples);

async function main() {
    const argv = parseArguments();
    const maxExamples = Math.max(1, Math.trunc(Number(argv.maxExamples) || 10));

    const files = {
        source: resolveCliPath(argv.source),
        catalog: resolveCliPath(argv.catalog),
        inventory: resolveCliPath(argv.inventory),
        pricebook: resolveCliPath(argv.pricebook)
    };

    const strictSetEquality = argv.strictSetEquality;

    const [catalogData, inventoryData, pricebookData] = await Promise.all([
        collectProducts(files.catalog),
        Promise.resolve(collectIdsFromRegex(files.inventory, /<record\s+product-id="([^"]+)"/g)),
        Promise.resolve(collectIdsFromRegex(files.pricebook, /<price-table\s+product-id="([^"]+)"/g))
    ]);

    const sourceData = await collectSourceIdsAndSelectedProducts(files.source, catalogData.allIds);

    const failures = [];
    const warnings = [];

    const fail = (code, message, details) => {
        failures.push({ code, message, details });
    };

    const warn = (code, message, details) => {
        warnings.push({ code, message, details });
    };

    if (catalogData.duplicateIds.size > 0) {
        fail('DUPLICATE_CATALOG_IDS', 'Filtered catalog contains duplicate product IDs.', {
            count: catalogData.duplicateIds.size,
            examples: summarizeExamples([...catalogData.duplicateIds], maxExamples)
        });
    }

    if (inventoryData.duplicateIds.size > 0) {
        fail('DUPLICATE_INVENTORY_IDS', 'Filtered inventory contains duplicate record product IDs.', {
            count: inventoryData.duplicateIds.size,
            examples: summarizeExamples([...inventoryData.duplicateIds], maxExamples)
        });
    }

    if (pricebookData.duplicateIds.size > 0) {
        fail('DUPLICATE_PRICEBOOK_IDS', 'Filtered pricebook contains duplicate price-table product IDs.', {
            count: pricebookData.duplicateIds.size,
            examples: summarizeExamples([...pricebookData.duplicateIds], maxExamples)
        });
    }

    const catalogNotInSource = setDifference(catalogData.allIds, sourceData.allIds);

    if (catalogNotInSource.length > 0) {
        fail('CATALOG_IDS_NOT_IN_SOURCE', 'Filtered catalog includes IDs that are missing from source catalog.', {
            count: catalogNotInSource.length,
            examples: summarizeExamples(catalogNotInSource, maxExamples)
        });
    }

    const inventoryNotInCatalog = setDifference(inventoryData.ids, catalogData.allIds);
    const pricebookNotInCatalog = setDifference(pricebookData.ids, catalogData.allIds);
    const catalogMissingInventory = setDifference(catalogData.allIds, inventoryData.ids);
    const catalogMissingPricebook = setDifference(catalogData.allIds, pricebookData.ids);

    if (inventoryNotInCatalog.length > 0) {
        fail('INVENTORY_IDS_NOT_IN_CATALOG', 'Inventory contains IDs not present in filtered catalog.', {
            count: inventoryNotInCatalog.length,
            examples: summarizeExamples(inventoryNotInCatalog, maxExamples)
        });
    }

    if (pricebookNotInCatalog.length > 0) {
        fail('PRICEBOOK_IDS_NOT_IN_CATALOG', 'Pricebook contains IDs not present in filtered catalog.', {
            count: pricebookNotInCatalog.length,
            examples: summarizeExamples(pricebookNotInCatalog, maxExamples)
        });
    }

    if (strictSetEquality && catalogMissingInventory.length > 0) {
        fail('CATALOG_IDS_MISSING_INVENTORY', 'Catalog contains IDs missing from inventory output.', {
            count: catalogMissingInventory.length,
            examples: summarizeExamples(catalogMissingInventory, maxExamples)
        });
    } else if (!strictSetEquality && catalogMissingInventory.length > 0) {
        warn('CATALOG_IDS_MISSING_INVENTORY', 'Catalog contains IDs missing from inventory output.', {
            count: catalogMissingInventory.length,
            examples: summarizeExamples(catalogMissingInventory, maxExamples)
        });
    }

    if (strictSetEquality && catalogMissingPricebook.length > 0) {
        fail('CATALOG_IDS_MISSING_PRICEBOOK', 'Catalog contains IDs missing from pricebook output.', {
            count: catalogMissingPricebook.length,
            examples: summarizeExamples(catalogMissingPricebook, maxExamples)
        });
    } else if (!strictSetEquality && catalogMissingPricebook.length > 0) {
        warn('CATALOG_IDS_MISSING_PRICEBOOK', 'Catalog contains IDs missing from pricebook output.', {
            count: catalogMissingPricebook.length,
            examples: summarizeExamples(catalogMissingPricebook, maxExamples)
        });
    }

    const missingSourceProducts = [];
    const valueMismatches = [];
    const shapeMismatches = [];

    for (const [productId, filteredProduct] of catalogData.productById.entries()) {
        const sourceProduct = sourceData.selectedProductById.get(productId);

        if (!sourceProduct) {
            missingSourceProducts.push(productId);
            continue;
        }

        const valueComparison = compareLeafValueMultiset(sourceProduct, filteredProduct, maxExamples);

        if (valueComparison.missingTotal > 0 || valueComparison.extraTotal > 0) {
            valueMismatches.push({
                productId,
                missingLeafValues: valueComparison.missingTotal,
                extraLeafValues: valueComparison.extraTotal,
                missingExamples: valueComparison.missingExamples,
                extraExamples: valueComparison.extraExamples
            });
        }

        const shapeComparison = compareShapeTokens(sourceProduct, filteredProduct, maxExamples);

        if (shapeComparison.missingTotal > 0 || shapeComparison.extraTotal > 0) {
            shapeMismatches.push({
                productId,
                missingShapeTokens: shapeComparison.missingTotal,
                extraShapeTokens: shapeComparison.extraTotal,
                missingExamples: shapeComparison.missingExamples,
                extraExamples: shapeComparison.extraExamples
            });
        }
    }

    if (missingSourceProducts.length > 0) {
        fail('MISSING_SOURCE_PRODUCTS_FOR_CATALOG_IDS', 'Some filtered products could not be found in source catalog stream.', {
            count: missingSourceProducts.length,
            examples: summarizeExamples(missingSourceProducts, maxExamples)
        });
    }

    if (valueMismatches.length > 0) {
        fail('PRODUCT_VALUE_MISMATCH', 'Filtered product value multisets differ from source for selected products.', {
            count: valueMismatches.length,
            examples: summarizeExamples(valueMismatches, maxExamples)
        });
    }

    if (shapeMismatches.length > 0) {
        fail('PRODUCT_SHAPE_MISMATCH', 'Filtered product structure token counts differ from source for selected products.', {
            count: shapeMismatches.length,
            examples: summarizeExamples(shapeMismatches, maxExamples)
        });
    }

    const catalogXml = fs.readFileSync(files.catalog, 'utf8');

    const undefinedSignals = {
        catalogUndefinedAttributes: countRegexMatches(catalogXml, /="undefined"/g),
        pricebookUndefinedAttributes: countRegexMatches(pricebookData.xml, /="undefined"/g),
        catalogVariationValueUndefined: countRegexMatches(catalogXml, /<variation[^>]*\bvalue="undefined"/g),
        catalogVariationAttributeUndefined: countRegexMatches(catalogXml, /<variation[^>]*\battribute-id="undefined"/g),
        catalogVariationValueEmpty: countRegexMatches(catalogXml, /<variation[^>]*\bvalue=""/g),
        catalogVariationAttributeEmpty: countRegexMatches(catalogXml, /<variation[^>]*\battribute-id=""/g),
        inventoryEmptyAllocation: countRegexMatches(inventoryData.xml, /<allocation>\s*<\/allocation>/g),
        pricebookEmptyAmount: countRegexMatches(pricebookData.xml, /<amount[^>]*>\s*<\/amount>/g)
    };

    if (undefinedSignals.catalogVariationValueUndefined > 0 || undefinedSignals.catalogVariationAttributeUndefined > 0) {
        fail('UNDEFINED_VARIATION_ATTRIBUTES', 'Filtered catalog contains variation attributes with undefined values.', undefinedSignals);
    }

    if (undefinedSignals.catalogVariationValueEmpty > 0 || undefinedSignals.catalogVariationAttributeEmpty > 0) {
        fail('EMPTY_VARIATION_ATTRIBUTES', 'Filtered catalog contains variation attributes with empty values.', undefinedSignals);
    }

    if (undefinedSignals.catalogUndefinedAttributes > 0 || undefinedSignals.pricebookUndefinedAttributes > 0) {
        fail('UNDEFINED_ATTRIBUTES_IN_OUTPUT', 'Inventory or pricebook contains undefined-valued XML attributes.', undefinedSignals);
    }

    if (undefinedSignals.inventoryEmptyAllocation > 0 || undefinedSignals.pricebookEmptyAmount > 0) {
        warn('EMPTY_CRITICAL_VALUES', 'Found empty allocation/amount nodes in output files.', undefinedSignals);
    }

    const malformedCatalogIds = [];

    for (const productId of catalogData.allIds) {
        if (productId.length === 0 || productId.length > 100 || productId.trim() !== productId || /\s/.test(productId)) {
            malformedCatalogIds.push(productId);
        }
    }

    if (malformedCatalogIds.length > 0) {
        fail('MALFORMED_CATALOG_PRODUCT_IDS', 'Filtered catalog product IDs violate expected SFCC length/whitespace constraints.', {
            count: malformedCatalogIds.length,
            examples: summarizeExamples(malformedCatalogIds, maxExamples)
        });
    }

    const report = {
        timestampUtc: new Date().toISOString(),
        files,
        options: {
            strictSetEquality,
            maxExamples
        },
        counts: {
            sourceProducts: sourceData.allIds.size,
            sourceDuplicates: sourceData.duplicateIds.size,
            filteredCatalogProducts: catalogData.allIds.size,
            filteredInventoryRecords: inventoryData.ids.size,
            filteredPricebookRows: pricebookData.ids.size
        },
        findings: {
            failures,
            warnings
        }
    };

    if (argv.report) {
        const reportFilePath = resolveCliPath(argv.report);
        fs.writeFileSync(reportFilePath, `${JSON.stringify(report, null, 2)}\n`);
    }

    if (argv.json) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        console.log('Output integrity validation report');
        console.log(`Source products: ${report.counts.sourceProducts}`);
        console.log(`Filtered catalog products: ${report.counts.filteredCatalogProducts}`);
        console.log(`Filtered inventory records: ${report.counts.filteredInventoryRecords}`);
        console.log(`Filtered pricebook rows: ${report.counts.filteredPricebookRows}`);
        console.log(`Failures: ${failures.length}`);
        console.log(`Warnings: ${warnings.length}`);

        if (failures.length > 0) {
            console.log('\nFailure details');

            for (let i = 0; i < failures.length; i++) {
                const finding = failures[i];
                console.log(`- [${finding.code}] ${finding.message}`);
            }
        }

        if (warnings.length > 0) {
            console.log('\nWarning details');

            for (let i = 0; i < warnings.length; i++) {
                const finding = warnings[i];
                console.log(`- [${finding.code}] ${finding.message}`);
            }
        }
    }

    if (failures.length > 0) {
        process.exitCode = 1;
    }
}

main().catch(error => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const XML_SCHEMA_VALIDATOR_MODULE_PATH = require.resolve('../lib/xmlSchemaValidator');
const XMLLINT_WASM_MODULE_PATH = require.resolve('xmllint-wasm');

const {
    validateGeneratedOutputs,
    deriveOutputFilename,
    derivePricebookOutputFilenames,
    deriveStorefrontOutputFilenames
} = require('../lib/xmlSchemaValidator');

const loadXmlSchemaValidatorWithValidateMock = validateXMLMock => {
    const originalValidatorModule = require.cache[XML_SCHEMA_VALIDATOR_MODULE_PATH];
    const originalXmllintModule = require.cache[XMLLINT_WASM_MODULE_PATH];

    delete require.cache[XML_SCHEMA_VALIDATOR_MODULE_PATH];
    require.cache[XMLLINT_WASM_MODULE_PATH] = {
        id: XMLLINT_WASM_MODULE_PATH,
        filename: XMLLINT_WASM_MODULE_PATH,
        loaded: true,
        exports: {
            validateXML: validateXMLMock
        }
    };

    const mockedValidatorModule = require('../lib/xmlSchemaValidator');

    return {
        mockedValidatorModule,
        restore: () => {
            if (originalValidatorModule) {
                require.cache[XML_SCHEMA_VALIDATOR_MODULE_PATH] = originalValidatorModule;
            } else {
                delete require.cache[XML_SCHEMA_VALIDATOR_MODULE_PATH];
            }

            if (originalXmllintModule) {
                require.cache[XMLLINT_WASM_MODULE_PATH] = originalXmllintModule;
            } else {
                delete require.cache[XMLLINT_WASM_MODULE_PATH];
            }
        }
    };
};

const makeSchema = (targetNamespace, rootElementName) => `
<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema
    xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns="${targetNamespace}"
    targetNamespace="${targetNamespace}"
    elementFormDefault="qualified"
    attributeFormDefault="unqualified">
    <xsd:import namespace="http://www.w3.org/XML/1998/namespace" schemaLocation="xml.xsd" />
    <xsd:element name="${rootElementName}">
        <xsd:complexType>
            <xsd:sequence />
        </xsd:complexType>
    </xsd:element>
</xsd:schema>
`;

const makeXml = (targetNamespace, rootElementName) => `<?xml version="1.0" encoding="UTF-8"?>\n<${rootElementName} xmlns="${targetNamespace}"/>\n`;

const writeValidationFixtureSet = async ({ xsdDir, outputFilename, selectorConfig = null, largeMarker = null }) => {
    const inventoryFilename = deriveOutputFilename(outputFilename, '-inventory');
    const pricebookFilenames = derivePricebookOutputFilenames(outputFilename, selectorConfig);
    const storefrontFilenames = deriveStorefrontOutputFilenames(outputFilename, selectorConfig);
    const marker = largeMarker ? `<!-- ${largeMarker} -->` : '';

    await fs.mkdir(xsdDir, { recursive: true });
    await fs.writeFile(path.join(xsdDir, 'catalog.xsd'), makeSchema('urn:test:catalog', 'catalog'), 'utf8');
    await fs.writeFile(path.join(xsdDir, 'inventory.xsd'), makeSchema('urn:test:inventory', 'inventory'), 'utf8');
    await fs.writeFile(path.join(xsdDir, 'pricebook.xsd'), makeSchema('urn:test:pricebook', 'pricebooks'), 'utf8');

    await fs.writeFile(outputFilename, `${makeXml('urn:test:catalog', 'catalog').trim()}${marker}\n`, 'utf8');
    await fs.writeFile(inventoryFilename, `${makeXml('urn:test:inventory', 'inventory').trim()}${marker}\n`, 'utf8');
    await Promise.all(pricebookFilenames.map(pricebookFilename => {
        return fs.writeFile(pricebookFilename, `${makeXml('urn:test:pricebook', 'pricebooks').trim()}${marker}\n`, 'utf8');
    }));
    await Promise.all(storefrontFilenames.map(storefrontFilename => {
        return fs.writeFile(storefrontFilename, `${makeXml('urn:test:catalog', 'catalog').trim()}${marker}\n`, 'utf8');
    }));
};

test('validateGeneratedOutputs validates catalog, inventory and pricebook XML files', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-xsd-validator-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const xsdDir = path.join(tempDir, 'xsd');
    const outputFilename = path.join(tempDir, 'output.xml');
    const inventoryFilename = deriveOutputFilename(outputFilename, '-inventory');
    const pricebookFilename = deriveOutputFilename(outputFilename, '-pricebook');

    await fs.mkdir(xsdDir, { recursive: true });
    await fs.writeFile(path.join(xsdDir, 'catalog.xsd'), makeSchema('urn:test:catalog', 'catalog'), 'utf8');
    await fs.writeFile(path.join(xsdDir, 'inventory.xsd'), makeSchema('urn:test:inventory', 'inventory'), 'utf8');
    await fs.writeFile(path.join(xsdDir, 'pricebook.xsd'), makeSchema('urn:test:pricebook', 'pricebooks'), 'utf8');

    await fs.writeFile(outputFilename, makeXml('urn:test:catalog', 'catalog'), 'utf8');
    await fs.writeFile(inventoryFilename, makeXml('urn:test:inventory', 'inventory'), 'utf8');
    await fs.writeFile(pricebookFilename, makeXml('urn:test:pricebook', 'pricebooks'), 'utf8');

    await assert.doesNotReject(() => validateGeneratedOutputs(outputFilename, xsdDir));
});

test('validateGeneratedOutputs rejects when an output XML does not match its schema', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-xsd-validator-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const xsdDir = path.join(tempDir, 'xsd');
    const outputFilename = path.join(tempDir, 'output.xml');
    const inventoryFilename = deriveOutputFilename(outputFilename, '-inventory');
    const pricebookFilename = deriveOutputFilename(outputFilename, '-pricebook');

    await fs.mkdir(xsdDir, { recursive: true });
    await fs.writeFile(path.join(xsdDir, 'catalog.xsd'), makeSchema('urn:test:catalog', 'catalog'), 'utf8');
    await fs.writeFile(path.join(xsdDir, 'inventory.xsd'), makeSchema('urn:test:inventory', 'inventory'), 'utf8');
    await fs.writeFile(path.join(xsdDir, 'pricebook.xsd'), makeSchema('urn:test:pricebook', 'pricebooks'), 'utf8');

    await fs.writeFile(outputFilename, makeXml('urn:test:catalog', 'catalog'), 'utf8');
    await fs.writeFile(inventoryFilename, makeXml('urn:test:inventory', 'wrong-root'), 'utf8');
    await fs.writeFile(pricebookFilename, makeXml('urn:test:pricebook', 'pricebooks'), 'utf8');

    await assert.rejects(
        () => validateGeneratedOutputs(outputFilename, xsdDir),
        /inventory output/i
    );
});

test('validateGeneratedOutputs validates one output pricebook file per configured source file', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-xsd-validator-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const xsdDir = path.join(tempDir, 'xsd');
    const outputFilename = path.join(tempDir, 'output.xml');
    const inventoryFilename = deriveOutputFilename(outputFilename, '-inventory');
    const selectorConfig = {
        pricebookSourceFiles: ['files/source/list-pricebook.xml', 'files/source/sale-pricebook.xml']
    };
    const pricebookFilenames = derivePricebookOutputFilenames(outputFilename, selectorConfig);

    await fs.mkdir(xsdDir, { recursive: true });
    await fs.writeFile(path.join(xsdDir, 'catalog.xsd'), makeSchema('urn:test:catalog', 'catalog'), 'utf8');
    await fs.writeFile(path.join(xsdDir, 'inventory.xsd'), makeSchema('urn:test:inventory', 'inventory'), 'utf8');
    await fs.writeFile(path.join(xsdDir, 'pricebook.xsd'), makeSchema('urn:test:pricebook', 'pricebooks'), 'utf8');

    await fs.writeFile(outputFilename, makeXml('urn:test:catalog', 'catalog'), 'utf8');
    await fs.writeFile(inventoryFilename, makeXml('urn:test:inventory', 'inventory'), 'utf8');
    await Promise.all(pricebookFilenames.map(pricebookFilename => {
        return fs.writeFile(pricebookFilename, makeXml('urn:test:pricebook', 'pricebooks'), 'utf8');
    }));

    await assert.doesNotReject(() => validateGeneratedOutputs(outputFilename, xsdDir, selectorConfig));
});

test('validateGeneratedOutputs validates one output storefront catalog file per configured source file', async t => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-xsd-validator-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const xsdDir = path.join(tempDir, 'xsd');
    const outputFilename = path.join(tempDir, 'output.xml');
    const inventoryFilename = deriveOutputFilename(outputFilename, '-inventory');
    const pricebookFilename = deriveOutputFilename(outputFilename, '-pricebook');
    const selectorConfig = {
        storefrontSourceFiles: ['files/source/storefront-a.xml', 'files/source/storefront-b.xml']
    };
    const storefrontFilenames = deriveStorefrontOutputFilenames(outputFilename, selectorConfig);

    await fs.mkdir(xsdDir, { recursive: true });
    await fs.writeFile(path.join(xsdDir, 'catalog.xsd'), makeSchema('urn:test:catalog', 'catalog'), 'utf8');
    await fs.writeFile(path.join(xsdDir, 'inventory.xsd'), makeSchema('urn:test:inventory', 'inventory'), 'utf8');
    await fs.writeFile(path.join(xsdDir, 'pricebook.xsd'), makeSchema('urn:test:pricebook', 'pricebooks'), 'utf8');

    await fs.writeFile(outputFilename, makeXml('urn:test:catalog', 'catalog'), 'utf8');
    await fs.writeFile(inventoryFilename, makeXml('urn:test:inventory', 'inventory'), 'utf8');
    await fs.writeFile(pricebookFilename, makeXml('urn:test:pricebook', 'pricebooks'), 'utf8');
    await Promise.all(storefrontFilenames.map(storefrontFilename => {
        return fs.writeFile(storefrontFilename, makeXml('urn:test:catalog', 'catalog'), 'utf8');
    }));

    await assert.doesNotReject(() => validateGeneratedOutputs(outputFilename, xsdDir, selectorConfig));
});

test('validateGeneratedOutputs clamps xmllint-wasm memory pages for small and large payload estimates', async t => {
    const capturedCalls = [];
    const { mockedValidatorModule, restore } = loadXmlSchemaValidatorWithValidateMock(async options => {
        capturedCalls.push({
            initialMemoryPages: options.initialMemoryPages,
            maxMemoryPages: options.maxMemoryPages
        });

        return {
            valid: true,
            errors: [],
            rawOutput: '',
            normalized: ''
        };
    });

    t.after(restore);

    const originalByteLength = Buffer.byteLength;
    t.after(() => {
        Buffer.byteLength = originalByteLength;
    });

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-xsd-validator-'));
    t.after(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    const xsdDir = path.join(tempDir, 'xsd');
    const smallOutputFilename = path.join(tempDir, 'small-output.xml');
    const largeOutputFilename = path.join(tempDir, 'large-output.xml');
    const largeMarker = 'mock-huge-validation-payload';
    const mockedHugeByteLength = 300 * 1024 * 1024;

    await writeValidationFixtureSet({ xsdDir, outputFilename: smallOutputFilename });
    await writeValidationFixtureSet({ xsdDir, outputFilename: largeOutputFilename, largeMarker });

    Buffer.byteLength = (value, encoding) => {
        if (typeof value === 'string' && value.includes(largeMarker)) {
            return mockedHugeByteLength;
        }

        return originalByteLength(value, encoding);
    };

    await assert.doesNotReject(() => mockedValidatorModule.validateGeneratedOutputs(smallOutputFilename, xsdDir));
    await assert.doesNotReject(() => mockedValidatorModule.validateGeneratedOutputs(largeOutputFilename, xsdDir));

    const smallCalls = capturedCalls.slice(0, 3);
    const largeCalls = capturedCalls.slice(3);

    assert.equal(smallCalls.length, 3);
    assert.equal(largeCalls.length, 3);

    for (const call of smallCalls) {
        assert.equal(call.initialMemoryPages, 256);
        assert.equal(call.maxMemoryPages, 512);
    }

    for (const call of largeCalls) {
        assert.equal(call.initialMemoryPages, 32768);
        assert.equal(call.maxMemoryPages, 32768);
    }
});

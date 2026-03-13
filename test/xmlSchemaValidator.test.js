const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const { validateGeneratedOutputs, deriveOutputFilename, derivePricebookOutputFilenames } = require('../lib/xmlSchemaValidator');

const execFileAsync = promisify(execFile);

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

const canRunXmllint = async () => {
    try {
        await execFileAsync('xmllint', ['--version']);
        return true;
    } catch (error) {
        return false;
    }
};

test('validateGeneratedOutputs validates catalog, inventory and pricebook XML files', async t => {
    if (!(await canRunXmllint())) {
        t.skip('xmllint is required for XML schema validation tests');
        return;
    }

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
    if (!(await canRunXmllint())) {
        t.skip('xmllint is required for XML schema validation tests');
        return;
    }

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
    if (!(await canRunXmllint())) {
        t.skip('xmllint is required for XML schema validation tests');
        return;
    }

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

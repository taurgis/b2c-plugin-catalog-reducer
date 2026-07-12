import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it, vi} from 'vitest';

import {
  deriveOutputFilename,
  derivePricebookOutputFilenames,
  deriveStorefrontOutputFilenames,
  validateGeneratedOutputs
} from './xmlSchemaValidator';

const makeSchema = (targetNamespace: string, rootElementName: string): string => `
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

const makeXml = (targetNamespace: string, rootElementName: string): string => `<?xml version="1.0" encoding="UTF-8"?>\n<${rootElementName} xmlns="${targetNamespace}"/>\n`;

const writeValidationFixtureSet = async ({xsdDir, outputFilename, selectorConfig = null, largeMarker = null}: {
  xsdDir: string;
  outputFilename: string;
  selectorConfig?: Record<string, unknown> | null;
  largeMarker?: string | null;
}) => {
  const inventoryFilename = deriveOutputFilename(outputFilename, '-inventory');
  const pricebookFilenames = derivePricebookOutputFilenames(outputFilename, selectorConfig);
  const storefrontFilenames = deriveStorefrontOutputFilenames(outputFilename, selectorConfig);
  const marker = largeMarker ? `<!-- ${largeMarker} -->` : '';

  await fs.mkdir(xsdDir, {recursive: true});
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

describe('validateGeneratedOutputs', () => {
  const tempDirs: string[] = [];

  const mkTempDir = async (): Promise<string> => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-xsd-validator-'));
    tempDirs.push(tempDir);
    return tempDir;
  };

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, {recursive: true, force: true})));
  });

  it('validates catalog, inventory and pricebook XML files', async () => {
    const tempDir = await mkTempDir();
    const xsdDir = path.join(tempDir, 'xsd');
    const outputFilename = path.join(tempDir, 'output.xml');
    const inventoryFilename = deriveOutputFilename(outputFilename, '-inventory');
    const pricebookFilename = deriveOutputFilename(outputFilename, '-pricebook');

    await fs.mkdir(xsdDir, {recursive: true});
    await fs.writeFile(path.join(xsdDir, 'catalog.xsd'), makeSchema('urn:test:catalog', 'catalog'), 'utf8');
    await fs.writeFile(path.join(xsdDir, 'inventory.xsd'), makeSchema('urn:test:inventory', 'inventory'), 'utf8');
    await fs.writeFile(path.join(xsdDir, 'pricebook.xsd'), makeSchema('urn:test:pricebook', 'pricebooks'), 'utf8');

    await fs.writeFile(outputFilename, makeXml('urn:test:catalog', 'catalog'), 'utf8');
    await fs.writeFile(inventoryFilename, makeXml('urn:test:inventory', 'inventory'), 'utf8');
    await fs.writeFile(pricebookFilename, makeXml('urn:test:pricebook', 'pricebooks'), 'utf8');

    await expect(validateGeneratedOutputs(outputFilename, xsdDir)).resolves.not.toThrow();
  });

  it('rejects when an output XML does not match its schema', async () => {
    const tempDir = await mkTempDir();
    const xsdDir = path.join(tempDir, 'xsd');
    const outputFilename = path.join(tempDir, 'output.xml');
    const inventoryFilename = deriveOutputFilename(outputFilename, '-inventory');
    const pricebookFilename = deriveOutputFilename(outputFilename, '-pricebook');

    await fs.mkdir(xsdDir, {recursive: true});
    await fs.writeFile(path.join(xsdDir, 'catalog.xsd'), makeSchema('urn:test:catalog', 'catalog'), 'utf8');
    await fs.writeFile(path.join(xsdDir, 'inventory.xsd'), makeSchema('urn:test:inventory', 'inventory'), 'utf8');
    await fs.writeFile(path.join(xsdDir, 'pricebook.xsd'), makeSchema('urn:test:pricebook', 'pricebooks'), 'utf8');

    await fs.writeFile(outputFilename, makeXml('urn:test:catalog', 'catalog'), 'utf8');
    await fs.writeFile(inventoryFilename, makeXml('urn:test:inventory', 'wrong-root'), 'utf8');
    await fs.writeFile(pricebookFilename, makeXml('urn:test:pricebook', 'pricebooks'), 'utf8');

    await expect(validateGeneratedOutputs(outputFilename, xsdDir)).rejects.toThrow(/inventory output/i);
  });

  it('validates one output pricebook file per configured source file', async () => {
    const tempDir = await mkTempDir();
    const xsdDir = path.join(tempDir, 'xsd');
    const outputFilename = path.join(tempDir, 'output.xml');
    const inventoryFilename = deriveOutputFilename(outputFilename, '-inventory');
    const selectorConfig = {
      pricebookSourceFiles: ['files/source/list-pricebook.xml', 'files/source/sale-pricebook.xml']
    };
    const pricebookFilenames = derivePricebookOutputFilenames(outputFilename, selectorConfig);

    await fs.mkdir(xsdDir, {recursive: true});
    await fs.writeFile(path.join(xsdDir, 'catalog.xsd'), makeSchema('urn:test:catalog', 'catalog'), 'utf8');
    await fs.writeFile(path.join(xsdDir, 'inventory.xsd'), makeSchema('urn:test:inventory', 'inventory'), 'utf8');
    await fs.writeFile(path.join(xsdDir, 'pricebook.xsd'), makeSchema('urn:test:pricebook', 'pricebooks'), 'utf8');

    await fs.writeFile(outputFilename, makeXml('urn:test:catalog', 'catalog'), 'utf8');
    await fs.writeFile(inventoryFilename, makeXml('urn:test:inventory', 'inventory'), 'utf8');
    await Promise.all(pricebookFilenames.map(pricebookFilename => {
      return fs.writeFile(pricebookFilename, makeXml('urn:test:pricebook', 'pricebooks'), 'utf8');
    }));

    await expect(validateGeneratedOutputs(outputFilename, xsdDir, selectorConfig)).resolves.not.toThrow();
  });

  it('validates one output storefront catalog file per configured source file', async () => {
    const tempDir = await mkTempDir();
    const xsdDir = path.join(tempDir, 'xsd');
    const outputFilename = path.join(tempDir, 'output.xml');
    const inventoryFilename = deriveOutputFilename(outputFilename, '-inventory');
    const pricebookFilename = deriveOutputFilename(outputFilename, '-pricebook');
    const selectorConfig = {
      storefrontSourceFiles: ['files/source/storefront-a.xml', 'files/source/storefront-b.xml']
    };
    const storefrontFilenames = deriveStorefrontOutputFilenames(outputFilename, selectorConfig);

    await fs.mkdir(xsdDir, {recursive: true});
    await fs.writeFile(path.join(xsdDir, 'catalog.xsd'), makeSchema('urn:test:catalog', 'catalog'), 'utf8');
    await fs.writeFile(path.join(xsdDir, 'inventory.xsd'), makeSchema('urn:test:inventory', 'inventory'), 'utf8');
    await fs.writeFile(path.join(xsdDir, 'pricebook.xsd'), makeSchema('urn:test:pricebook', 'pricebooks'), 'utf8');

    await fs.writeFile(outputFilename, makeXml('urn:test:catalog', 'catalog'), 'utf8');
    await fs.writeFile(inventoryFilename, makeXml('urn:test:inventory', 'inventory'), 'utf8');
    await fs.writeFile(pricebookFilename, makeXml('urn:test:pricebook', 'pricebooks'), 'utf8');
    await Promise.all(storefrontFilenames.map(storefrontFilename => {
      return fs.writeFile(storefrontFilename, makeXml('urn:test:catalog', 'catalog'), 'utf8');
    }));

    await expect(validateGeneratedOutputs(outputFilename, xsdDir, selectorConfig)).resolves.not.toThrow();
  });

  it('clamps xmllint-wasm memory pages for small and large payload estimates', async () => {
    const capturedCalls: Array<{initialMemoryPages: number; maxMemoryPages: number}> = [];
    const validateXMLMock = vi.fn(async (options: any) => {
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

    vi.resetModules();
    vi.doMock('xmllint-wasm', () => ({validateXML: validateXMLMock}));

    const {validateGeneratedOutputs: mockedValidateGeneratedOutputs} = await import('./xmlSchemaValidator');

    const originalByteLength = Buffer.byteLength;
    const tempDir = await mkTempDir();
    const xsdDir = path.join(tempDir, 'xsd');
    const smallOutputFilename = path.join(tempDir, 'small-output.xml');
    const largeOutputFilename = path.join(tempDir, 'large-output.xml');
    const largeMarker = 'mock-huge-validation-payload';
    const mockedHugeByteLength = 300 * 1024 * 1024;

    await writeValidationFixtureSet({xsdDir, outputFilename: smallOutputFilename});
    await writeValidationFixtureSet({xsdDir, outputFilename: largeOutputFilename, largeMarker});

    (Buffer as any).byteLength = (value: unknown, encoding?: BufferEncoding) => {
      if (typeof value === 'string' && value.includes(largeMarker)) {
        return mockedHugeByteLength;
      }

      return originalByteLength(value as string, encoding);
    };

    try {
      await expect(mockedValidateGeneratedOutputs(smallOutputFilename, xsdDir)).resolves.not.toThrow();
      await expect(mockedValidateGeneratedOutputs(largeOutputFilename, xsdDir)).resolves.not.toThrow();
    } finally {
      Buffer.byteLength = originalByteLength;
      vi.doUnmock('xmllint-wasm');
      vi.resetModules();
    }

    const smallCalls = capturedCalls.slice(0, 3);
    const largeCalls = capturedCalls.slice(3);

    expect(smallCalls).toHaveLength(3);
    expect(largeCalls).toHaveLength(3);

    for (const call of smallCalls) {
      expect(call.initialMemoryPages).toBe(256);
      expect(call.maxMemoryPages).toBe(512);
    }

    for (const call of largeCalls) {
      expect(call.initialMemoryPages).toBe(32768);
      expect(call.maxMemoryPages).toBe(32768);
    }
  });
});

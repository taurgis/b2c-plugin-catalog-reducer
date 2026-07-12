// Writes the reduced inventory XML output. Split out of the legacy
// monolithic lib/parser.js.
import fsPromises from 'node:fs/promises';

import {Logger, XmlNode} from '../types';
import {
  escapeXmlAttribute,
  INVENTORY_LIST_ID,
  INVENTORY_XML_NAMESPACE,
  serializeXml,
  writeXmlChunks,
  XML_HEADER
} from './xmlSerialization';

const buildCompactInventoryChunks = function* (productSelection: XmlNode[]): Generator<string> {
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

const buildInventoryList = (productSelection: XmlNode[]): XmlNode => {
  const inventoryList: XmlNode = {
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
        record: [] as XmlNode[]
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

export const writeInventoryXml = async (
  outputFilename: string,
  productSelection: XmlNode[],
  beautifyOutput: boolean,
  logger: Logger
): Promise<void> => {
  if (!beautifyOutput) {
    await writeXmlChunks(outputFilename, buildCompactInventoryChunks(productSelection));
    logger.info('Done writing inventory output file');
    return;
  }

  const inventoryXML = await serializeXml(buildInventoryList(productSelection), beautifyOutput, logger);

  await fsPromises.writeFile(outputFilename, inventoryXML, 'utf8');
  logger.info('Done writing inventory output file');
};

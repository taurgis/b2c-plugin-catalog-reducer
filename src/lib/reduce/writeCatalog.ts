// Writes the primary reduced catalog XML output. Split out of the legacy
// monolithic lib/parser.js.
import '../vendor-shims';
import fsPromises from 'node:fs/promises';

import flow from 'xml-flow';

import {Logger, XmlNode} from '../types';
import {
  CATALOG_XML_NAMESPACE,
  escapeXmlAttribute,
  serializeXml,
  writeXmlChunks,
  XML_HEADER
} from './xmlSerialization';

const buildCompactCatalogChunks = function* (catalogId: string, selectedProducts: XmlNode[]): Generator<string> {
  yield XML_HEADER;
  yield `<catalog xmlns="${CATALOG_XML_NAMESPACE}" catalog-id="${escapeXmlAttribute(catalogId)}">`;

  for (let i = 0; i < selectedProducts.length; i++) {
    yield flow.toXml({
      product: selectedProducts[i]
    });
  }

  yield '</catalog>';
};

export const writeCatalogXml = async (
  outputFilename: string,
  catalogSelection: XmlNode,
  beautifyOutput: boolean,
  logger: Logger
): Promise<void> => {
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

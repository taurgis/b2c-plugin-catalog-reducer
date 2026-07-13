import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterEach, describe, expect, it} from 'vitest';

import {buildImageManifest} from './imageManifest';

const CATALOG_XML = `<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="storefront-catalog">
  <product product-id="p1">
    <images>
      <image-group view-type="large">
        <image path="/a/large.jpg"/>
      </image-group>
      <image-group view-type="zoom">
        <image path="/a/large.jpg"/>
      </image-group>
    </images>
  </product>
  <product product-id="p2">
    <images>
      <image-group view-type="swatch">
        <image path="/a/large.jpg"/>
        <image path="/b/swatch.jpg"/>
      </image-group>
    </images>
  </product>
  <product product-id="p3">
  </product>
</catalog>
`;

describe('buildImageManifest', () => {
  const tempDirs: string[] = [];

  const withTempCatalogFile = async (xml: string): Promise<string> => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-image-manifest-'));
    tempDirs.push(tempDir);

    const inputFilename = path.join(tempDir, 'reduced-catalog.xml');
    await fs.writeFile(inputFilename, xml, 'utf8');

    return inputFilename;
  };

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, {recursive: true, force: true})));
  });

  it('builds a manifest with per-product entries and a globally deduped path list', async () => {
    const inputFilename = await withTempCatalogFile(CATALOG_XML);

    const manifest = await buildImageManifest(inputFilename);

    expect(manifest.productCount).toBe(3);
    expect(manifest.productsWithImages).toBe(2);
    expect(manifest.entries).toEqual([
      {imagePaths: ['/a/large.jpg'], productId: 'p1'},
      {imagePaths: ['/a/large.jpg', '/b/swatch.jpg'], productId: 'p2'}
    ]);
    expect(manifest.uniqueImagePaths.sort()).toEqual(['/a/large.jpg', '/b/swatch.jpg']);
  });

  it('rejects when the input file does not exist', async () => {
    await expect(buildImageManifest('/nonexistent/reduced-catalog.xml')).rejects.toBeTruthy();
  });

  it('resolves an empty manifest for a catalog with no products', async () => {
    const inputFilename = await withTempCatalogFile(
      '<?xml version="1.0" encoding="UTF-8"?><catalog catalog-id="empty"></catalog>'
    );

    const manifest = await buildImageManifest(inputFilename);

    expect(manifest).toEqual({
      entries: [],
      productCount: 0,
      productsWithImages: 0,
      uniqueImagePaths: []
    });
  });
});

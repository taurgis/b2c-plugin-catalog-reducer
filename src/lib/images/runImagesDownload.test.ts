import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const createLiveWebdavInstance = vi.fn();
const createSdkWebdavImageClient = vi.fn();
const downloadImages = vi.fn();

vi.mock('./sdkInstance', () => ({createLiveWebdavInstance}));
vi.mock('./webdavClient', () => ({createSdkWebdavImageClient}));
vi.mock('./downloadImages', () => ({downloadImages}));

const CATALOG_WITH_IMAGES = `<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="storefront-catalog">
  <product product-id="p1">
    <images><image-group view-type="large"><image path="/a/1.jpg"/></image-group></images>
  </product>
</catalog>
`;

const buildCatalogWithNImages = (count: number): string => {
  const images = Array.from({length: count}, (_, i) => `<image path="/a/${i}.jpg"/>`).join('');

  return '<?xml version="1.0" encoding="UTF-8"?>'
    + '<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="storefront-catalog">'
    + `<product product-id="p1"><images><image-group view-type="large">${images}</image-group></images></product>`
    + '</catalog>';
};

const CATALOG_WITHOUT_IMAGES = '<?xml version="1.0" encoding="UTF-8"?><catalog catalog-id="empty"></catalog>';

const createRecordingLogger = () => {
  const info: unknown[][] = [];
  const warn: unknown[][] = [];

  return {
    info,
    logger: {
      error: () => {},
      info: (...args: unknown[]) => info.push(args),
      warn: (...args: unknown[]) => warn.push(args)
    },
    warn
  };
};

describe('runImagesDownload', () => {
  const tempDirs: string[] = [];

  const withTempCatalogFile = async (xml: string): Promise<string> => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-reducer-run-images-download-'));
    tempDirs.push(tempDir);

    const inputFilename = path.join(tempDir, 'reduced-catalog.xml');
    await fs.writeFile(inputFilename, xml, 'utf8');

    return inputFilename;
  };

  beforeEach(() => {
    createLiveWebdavInstance.mockReset();
    createSdkWebdavImageClient.mockReset();
    downloadImages.mockReset();
  });

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, {recursive: true, force: true})));
  });

  it('in dry-run mode, previews jobs and never touches the live instance/client/download layer', async () => {
    const inputFilename = await withTempCatalogFile(CATALOG_WITH_IMAGES);
    const {logger, info} = createRecordingLogger();
    const {runImagesDownload} = await import('./runImagesDownload');

    const result = await runImagesDownload({
      concurrency: 4,
      dryRun: true,
      input: inputFilename,
      libraryPath: 'mylibrary/default',
      logger,
      output: '/tmp/out'
    });

    expect(result).toEqual({dryRun: true});
    expect(createLiveWebdavInstance).not.toHaveBeenCalled();
    expect(downloadImages).not.toHaveBeenCalled();
    expect(info.flat().join('\n')).toContain('Libraries/mylibrary/default/a/1.jpg');
  });

  it('in dry-run mode, truncates the preview and reports how many more images were omitted', async () => {
    const inputFilename = await withTempCatalogFile(buildCatalogWithNImages(7));
    const {logger, info} = createRecordingLogger();
    const {runImagesDownload} = await import('./runImagesDownload');

    await runImagesDownload({
      concurrency: 4,
      dryRun: true,
      input: inputFilename,
      libraryPath: 'mylibrary/default',
      logger,
      output: '/tmp/out'
    });

    expect(info.flat().join('\n')).toContain('... and 2 more');
  });

  it('skips the live instance/download layer entirely when there are no images', async () => {
    const inputFilename = await withTempCatalogFile(CATALOG_WITHOUT_IMAGES);
    const {logger} = createRecordingLogger();
    const {runImagesDownload} = await import('./runImagesDownload');

    const result = await runImagesDownload({
      concurrency: 4,
      input: inputFilename,
      libraryPath: 'mylibrary/default',
      logger,
      output: '/tmp/out'
    });

    expect(result).toEqual({dryRun: false});
    expect(createLiveWebdavInstance).not.toHaveBeenCalled();
    expect(downloadImages).not.toHaveBeenCalled();
  });

  it('downloads through the real wiring and returns the summary when images are present', async () => {
    const inputFilename = await withTempCatalogFile(CATALOG_WITH_IMAGES);
    const {logger, warn} = createRecordingLogger();
    const fakeInstance = {webdav: {get: vi.fn()}};
    const fakeClient = {download: vi.fn()};
    const summary = {failed: 1, failures: [{imagePath: '/a/1.jpg', message: 'boom'}], succeeded: 0, total: 1};

    createLiveWebdavInstance.mockResolvedValue(fakeInstance);
    createSdkWebdavImageClient.mockReturnValue(fakeClient);
    downloadImages.mockResolvedValue(summary);

    const {runImagesDownload} = await import('./runImagesDownload');

    const result = await runImagesDownload({
      concurrency: 8,
      input: inputFilename,
      libraryPath: 'mylibrary/default',
      logger,
      output: '/tmp/out'
    });

    expect(createSdkWebdavImageClient).toHaveBeenCalledWith(fakeInstance);
    expect(downloadImages).toHaveBeenCalledWith(
      [{imagePath: '/a/1.jpg', localPath: expect.any(String), remotePath: 'Libraries/mylibrary/default/a/1.jpg'}],
      fakeClient,
      {concurrency: 8}
    );
    expect(result).toEqual({dryRun: false, summary});
    expect(warn.flat().join('\n')).toContain('Failed to download /a/1.jpg: boom');
  });
});

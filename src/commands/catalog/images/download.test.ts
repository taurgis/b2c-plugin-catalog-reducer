import {beforeEach, describe, expect, it, vi} from 'vitest';

const runImagesDownload = vi.fn();

vi.mock('../../../lib/images/runImagesDownload', () => ({runImagesDownload}));

describe('catalog images download command', () => {
  beforeEach(() => {
    runImagesDownload.mockReset();
  });

  it('fails fast when --library-path is missing, without calling runImagesDownload', async () => {
    const {default: CatalogImagesDownload} = await import('./download');

    await expect(
      CatalogImagesDownload.run(['-i', 'in.xml', '-o', 'out-dir'])
    ).rejects.toThrow();

    expect(runImagesDownload).not.toHaveBeenCalled();
  });

  it('fails fast when --input is missing', async () => {
    const {default: CatalogImagesDownload} = await import('./download');

    await expect(
      CatalogImagesDownload.run(['-o', 'out-dir', '--library-path', 'lib/default'])
    ).rejects.toThrow();

    expect(runImagesDownload).not.toHaveBeenCalled();
  });

  it('fails fast when --output is missing', async () => {
    const {default: CatalogImagesDownload} = await import('./download');

    await expect(
      CatalogImagesDownload.run(['-i', 'in.xml', '--library-path', 'lib/default'])
    ).rejects.toThrow();

    expect(runImagesDownload).not.toHaveBeenCalled();
  });

  it('passes flags through to runImagesDownload and does not force an exit on success', async () => {
    runImagesDownload.mockResolvedValue({dryRun: false, summary: {failed: 0, failures: [], succeeded: 2, total: 2}});
    const {default: CatalogImagesDownload} = await import('./download');

    await CatalogImagesDownload.run([
      '-i', 'in.xml',
      '-o', 'out-dir',
      '--library-path', 'mylibrary/default',
      '--dry-run',
      '--concurrency', '8'
    ]);

    expect(runImagesDownload).toHaveBeenCalledWith({
      concurrency: 8,
      dryRun: true,
      input: 'in.xml',
      libraryPath: 'mylibrary/default',
      output: 'out-dir'
    });
  });

  it('exits non-zero when the returned summary reports failures', async () => {
    runImagesDownload.mockResolvedValue({
      dryRun: false,
      summary: {failed: 1, failures: [{imagePath: '/a/2.jpg', message: 'boom'}], succeeded: 1, total: 2}
    });
    const {default: CatalogImagesDownload} = await import('./download');

    await expect(
      CatalogImagesDownload.run(['-i', 'in.xml', '-o', 'out-dir', '--library-path', 'mylibrary/default'])
    ).rejects.toMatchObject({oclif: {exit: 1}});
  });

  it('does not force an exit when there is no summary (dry-run or no images)', async () => {
    runImagesDownload.mockResolvedValue({dryRun: true});
    const {default: CatalogImagesDownload} = await import('./download');

    await CatalogImagesDownload.run([
      '-i', 'in.xml',
      '-o', 'out-dir',
      '--library-path', 'mylibrary/default',
      '--dry-run'
    ]);

    // No assertion needed beyond "did not throw" - reaching here proves no forced exit.
  });

  it('sanitizes credential values from a thrown error before surfacing it', async () => {
    runImagesDownload.mockRejectedValue(new Error('401: Authorization: Basic ZmFrZTpzZWNyZXQ='));
    const {default: CatalogImagesDownload} = await import('./download');

    const failure = await CatalogImagesDownload.run([
      '-i', 'in.xml',
      '-o', 'out-dir',
      '--library-path', 'mylibrary/default'
    ]).catch(error => error);

    expect(failure).toMatchObject({code: 'CATALOG_IMAGES_DOWNLOAD_FAILED'});
    expect(String(failure.message)).not.toContain('ZmFrZTpzZWNyZXQ=');
    expect(String(failure.message)).toContain('[REDACTED]');
  });
});

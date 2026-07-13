import {Command, Flags} from '@oclif/core';

import {sanitizeErrorMessage} from '../../../lib/images/redact';
import {runImagesDownload, RunImagesDownloadResult} from '../../../lib/images/runImagesDownload';

export default class CatalogImagesDownload extends Command {
  static summary = '[Experimental] Download product images for a reduced catalog from a live B2C sandbox.';

  static description =
    'Reads the product images referenced in an already-reduced catalog XML file and downloads them '
    + 'from a live B2C sandbox over WebDAV. This command is experimental: its flags and behavior may '
    + 'change. Sandbox authentication is resolved the same way as other B2C CLI commands (dw.json, '
    + 'environment variables, or ~/.mobify) - it takes no credential flags of its own.';

  static examples = [
    '<%= config.bin %> <%= command.id %> -i ./catalog-reduced.xml -o ./images '
    + '--library-path mylibrary/default'
  ];

  static flags = {
    input: Flags.string({
      char: 'i',
      description: 'Reduced catalog XML file (the output of `catalog reduce`).',
      required: true
    }),
    output: Flags.string({
      char: 'o',
      description: 'Local directory to download images into.',
      required: true
    }),
    'library-path': Flags.string({
      description:
        'Path under the WebDAV Libraries root to this catalog\'s image library, '
        + 'e.g. "mylibrary/default". Instance-specific - configured in Business Manager '
        + 'under Site Development > WebDAV Access. There is no default.',
      required: true
    }),
    'dry-run': Flags.boolean({
      default: false,
      description: 'List resolved image counts and destinations without downloading or making any network calls.'
    }),
    concurrency: Flags.integer({
      default: 4,
      description: 'Maximum number of images to download at once.'
    })
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(CatalogImagesDownload);

    let result: RunImagesDownloadResult;

    try {
      result = await runImagesDownload({
        concurrency: flags.concurrency,
        dryRun: flags['dry-run'],
        input: flags.input,
        libraryPath: flags['library-path'],
        output: flags.output
      });
    } catch (error) {
      this.error(sanitizeErrorMessage(error), {code: 'CATALOG_IMAGES_DOWNLOAD_FAILED'});
    }

    if (result.summary && result.summary.failed > 0) {
      this.exit(1);
    }
  }
}

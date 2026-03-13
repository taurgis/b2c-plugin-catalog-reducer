import {Command, Flags} from '@oclif/core';

import {runReducer} from '../../lib/reducer-runner';

export default class CatalogReduce extends Command {
  static summary = 'Reduce a catalog XML dataset into smaller catalog, inventory, and pricebook outputs.';

  static description =
    'Runs the catalog reducer workflow and writes reduced catalog, inventory, and pricebook XML outputs.';

  static examples = [
    '<%= config.bin %> <%= command.id %> -i ./catalog.xml -o ./catalog-reduced.xml -c ./catalog-reducer.json'
  ];

  static flags = {
    config: Flags.string({
      char: 'c',
      description: 'Path to a JSON config file. Relative paths are resolved from the current working directory.',
      required: false
    }),
    input: Flags.string({
      char: 'i',
      description: 'Source catalog XML file.',
      required: true
    }),
    output: Flags.string({
      char: 'o',
      description: 'Reduced catalog output XML file.',
      required: true
    })
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(CatalogReduce);

    try {
      const exitCode = await runReducer({
        config: flags.config,
        input: flags.input,
        invocationCwd: process.cwd(),
        output: flags.output
      });

      if (exitCode !== 0) {
        this.exit(exitCode);
      }
    } catch (error) {
      this.error(error instanceof Error ? error : String(error), {
        code: 'CATALOG_REDUCE_FAILED'
      });
    }
  }
}
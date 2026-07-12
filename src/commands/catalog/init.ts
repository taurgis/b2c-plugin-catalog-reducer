import {Command, Flags} from '@oclif/core';
import path from 'node:path';
import readline from 'node:readline/promises';

import {buildScaffoldedConfig, detectCatalogStructure, writeScaffoldedConfig} from '../../lib/catalogInit';

export default class CatalogInit extends Command {
  static summary = 'Scaffold a catalog reducer config file by detecting an existing catalog folder structure.';

  static description =
    'Detects catalog/pricebook/storefront XML files in a directory and writes a starter config file. '
    + 'Always writes an explicit config file path for use with `catalog reduce -c <path>` - it never registers an implicit named profile.';

  static examples = [
    '<%= config.bin %> <%= command.id %> --dir ./files/source -o ./catalog-reducer.json',
    '<%= config.bin %> <%= command.id %> --dir ./files/source -o ./catalog-reducer.json --yes --total 1000 --master 100'
  ];

  static flags = {
    dir: Flags.string({
      description: 'Directory to scan for catalog/pricebook/storefront XML files.',
      default: '.'
    }),
    output: Flags.string({
      char: 'o',
      description: 'Path to write the scaffolded config file.',
      default: 'catalog-reducer.json'
    }),
    catalog: Flags.string({
      description: 'Explicit path to the master catalog XML file (bypasses auto-detection).'
    }),
    total: Flags.integer({
      description: 'Total product target to write into the scaffolded config.'
    }),
    master: Flags.integer({
      description: 'Master product target to write into the scaffolded config.'
    }),
    'site-id': Flags.string({
      description: 'Restrict online-status checks to this site ID. Repeatable.',
      multiple: true
    }),
    yes: Flags.boolean({
      char: 'y',
      default: false,
      description: 'Skip interactive prompts; fail with an actionable error if catalog detection is ambiguous and --catalog is not given.'
    }),
    force: Flags.boolean({
      char: 'f',
      default: false,
      description: 'Overwrite the output file if it already exists.'
    })
  };

  async run(): Promise<void> {
    const {flags} = await this.parse(CatalogInit);
    const scanDirectory = path.resolve(process.cwd(), flags.dir);
    const detected = await detectCatalogStructure(scanDirectory);

    let catalogFile = flags.catalog ? path.resolve(process.cwd(), flags.catalog) : detected.catalogFile;

    if (!catalogFile) {
      if (flags.yes) {
        this.error(
          detected.ambiguousCatalogCandidates.length > 1
            ? `Multiple candidate catalog files found in ${scanDirectory}: ${detected.ambiguousCatalogCandidates.join(', ')}. Pass --catalog to pick one explicitly.`
            : `No catalog XML file found in ${scanDirectory}. Pass --catalog to specify one explicitly.`,
          {code: 'CATALOG_INIT_NO_CATALOG_DETECTED'}
        );
      }

      catalogFile = await this.promptForCatalogFile(detected.ambiguousCatalogCandidates, scanDirectory);
    }

    const total = flags.total ?? (flags.yes ? 1000 : await this.promptForNumber('Total product target', 1000));
    const master = flags.master ?? (flags.yes ? 0 : await this.promptForNumber('Master product target', 0));

    const config = buildScaffoldedConfig({
      total,
      master,
      onlineSiteIds: flags['site-id'] ?? [],
      pricebookSourceFiles: detected.pricebookFiles,
      storefrontSourceFiles: detected.storefrontFiles
    });

    const outputPath = path.resolve(process.cwd(), flags.output);

    try {
      await writeScaffoldedConfig(outputPath, config, flags.force);
    } catch (error) {
      this.error(error instanceof Error ? error : String(error), {code: 'CATALOG_INIT_WRITE_FAILED'});
    }

    this.log(`Wrote config to ${outputPath}`);
    this.log(`Detected master catalog: ${catalogFile}`);

    if (detected.pricebookFiles.length > 0) {
      this.log(`Detected pricebook source files: ${detected.pricebookFiles.join(', ')}`);
    }

    if (detected.storefrontFiles.length > 0) {
      this.log(`Detected storefront source files: ${detected.storefrontFiles.join(', ')}`);
    }

    this.log(`Run: ${this.config.bin} catalog reduce -i ${catalogFile} -o <output.xml> -c ${outputPath}`);
  }

  private async promptForCatalogFile(candidates: string[], scanDirectory: string): Promise<string> {
    const rl = readline.createInterface({input: process.stdin, output: process.stdout});

    try {
      if (candidates.length === 0) {
        const answer = await rl.question(`No catalog XML file detected in ${scanDirectory}. Enter a path: `);

        return path.resolve(process.cwd(), answer.trim());
      }

      this.log(`Multiple candidate catalog files found in ${scanDirectory}:`);
      candidates.forEach((candidate, index) => this.log(`  ${index + 1}. ${candidate}`));

      const answer = await rl.question(`Select one (1-${candidates.length}): `);
      const index = Number.parseInt(answer, 10) - 1;

      if (Number.isNaN(index) || index < 0 || index >= candidates.length) {
        this.error(`Invalid selection: ${answer}`, {code: 'CATALOG_INIT_INVALID_SELECTION'});
      }

      return candidates[index];
    } finally {
      rl.close();
    }
  }

  private async promptForNumber(label: string, defaultValue: number): Promise<number> {
    const rl = readline.createInterface({input: process.stdin, output: process.stdout});

    try {
      const answer = await rl.question(`${label} [${defaultValue}]: `);

      if (!answer.trim()) {
        return defaultValue;
      }

      const parsed = Number.parseInt(answer, 10);

      return Number.isNaN(parsed) ? defaultValue : parsed;
    } finally {
      rl.close();
    }
  }
}

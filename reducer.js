const parser = require('./lib/parser');
const { DEFAULT_SELECTOR_CONFIG, loadConfigFile } = require('./lib/selectorConfig');
const xmlSchemaValidator = require('./lib/xmlSchemaValidator');
const path = require('path');
const yargs = require('yargs');
const chalk = require('chalk');


const argv = yargs
    .option('project', {
        alias: 'p',
        description: 'Removed. Use --config /path/to/config.json instead.',
        type: 'string',
    })
    .option('config', {
        alias: 'c',
        description: 'Path to a JSON config file. Relative paths are resolved from the current working directory.',
        type: 'string',
    })
    .option('input', {
        alias: 'i',
        description: 'The source catalog XML file.',
        type: 'string',
        demandOption : true
    })
    .option('output', {
        alias: 'o',
        description: 'The output catalog XML file.',
        type: 'string',
        demandOption : true
    })
    .option('dry-run', {
        description: 'Run product selection and print a summary without writing any output files.',
        type: 'boolean',
        default: false
    })
    .option('cache', {
        description: 'Reuse a cached product selection when the input file and config are unchanged. Use --no-cache to force a fresh parse.',
        type: 'boolean',
        default: true
    })
    .help()
    .alias('help', 'h')
    .hide('project')
    .argv;

const resolveCliPath = inputPath => path.resolve(process.cwd(), inputPath);

async function main() {
    if (argv.project) {
        throw new Error('The --project/-p option has been removed. Use --config /path/to/config.json instead.');
    }

    const config = argv.config ? await loadConfigFile(argv.config) : DEFAULT_SELECTOR_CONFIG;
    const inputFilename = resolveCliPath(argv.input);
    const outputFilename = resolveCliPath(argv.output);

    console.log(chalk.blue('\nRunning catalog reducer with the following config:'));
    console.log(chalk.yellow('------------------------------'));
    console.log(chalk.yellow(JSON.stringify(config, null, 4)));
    console.log(chalk.yellow('------------------------------\n'));

    await parser.parse(inputFilename, outputFilename, config, { dryRun: argv.dryRun, useCache: argv.cache });

    if (argv.dryRun) {
        console.log(chalk.yellow('Dry run complete. No files were written; skipping XSD validation.'));
        return;
    }

    console.log(chalk.yellow('Validating generated XML files against XSD schemas'));
    await xmlSchemaValidator.validateGeneratedOutputs(outputFilename, undefined, config);
    console.log(chalk.green('XSD validation passed.'));
    console.log(chalk.yellow('Done!'));
}

main().catch(error => {
    console.error(chalk.red('Catalog reduction failed.'));
    console.error(error);
    process.exitCode = 1;
});


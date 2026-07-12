# Catalog Reducer

Catalog Reducer generates smaller, representative Salesforce B2C Commerce catalog datasets from large source XML files.

It keeps product selection configurable, exposes a root oclif command for reduction workflows, writes derived inventory and pricebook XML outputs, and validates generated files against the bundled XSD schemas.

Repository-local fixtures and sample profiles under `files/` and `config/` are for local development and debugging. They are not part of the published package.

## Highlights

- Reduces large catalog XML files into smaller fixture datasets
- Supports preferred product IDs, master-product targets, attribute-driven selection, and filler products
- Writes catalog, inventory, and pricebook outputs in one run
- Supports source-derived storefront catalog outputs that preserve category structure while pruning category assignments to selected products
- Supports generated or source-derived pricebook outputs
- Validates generated XML against the bundled catalog, inventory, and pricebook schemas
- Includes repeatable benchmark and output-integrity tooling

## Prerequisites

Install the Salesforce B2C CLI first if you want to run this reducer as a B2C CLI plugin:

```bash
npm install -g @salesforce/b2c-cli
b2c --version
```

Official plugin lifecycle commands are documented in the Salesforce B2C Developer Tooling guides for [extending the B2C CLI](https://salesforcecommercecloud.github.io/b2c-developer-tooling/guide/extending.html) and [third-party plugins](https://salesforcecommercecloud.github.io/b2c-developer-tooling/guide/third-party-plugins.html).

System requirements:

- No external XML validator is required. XSD validation runs through the bundled `xmllint-wasm` dependency.

## Repository Setup

```bash
npm install
```

- `npm install` bootstraps both the root CLI and the reducer runtime dependencies.

## Use In B2C CLI

This package exposes `catalog reduce` as an oclif command, so once the plugin is linked or installed in `b2c`, the reducer runs as:

```bash
b2c catalog reduce -i ./catalog.xml -o ./catalog-reduced.xml -c ./catalog-reducer.json
```

### Link A Local Checkout

Use this flow while developing in this repository or before publishing the package to npm:

```bash
npm install
npm run build
b2c plugins link /absolute/path/to/b2c-plugin-catalog-reducer
b2c plugins
b2c help catalog reduce
```

Re-run `npm run build` after TypeScript changes so `b2c` loads the latest files from `dist/`.

To remove the linked plugin:

```bash
b2c plugins unlink b2c-plugin-catalog-reducer
```

### Install A Published Package

If this package is published to npm, install it into `b2c` with the package name:

```bash
b2c plugins install b2c-plugin-catalog-reducer
b2c plugins
b2c help catalog reduce
```

To uninstall the published plugin:

```bash
b2c plugins uninstall b2c-plugin-catalog-reducer
```

### Run The Reducer Through B2C CLI

```bash
b2c catalog reduce -i ./catalog.xml -o ./catalog-reduced.xml -c ./catalog-reducer.json
```

Arguments:

- `-c`, `--config`: path to a JSON config file anywhere on disk
- `-i`, `--input`: source catalog XML file
- `-o`, `--output`: reduced catalog output file
- `--dry-run`: run product selection and print a summary without writing any output files
- `--cache` / `--no-cache`: reuse a cached product selection when the input file and config are unchanged (enabled by default; use `--no-cache` to force a fresh parse)

Relative input and output paths are resolved from the directory where you invoke `b2c`.

When `--config` is used, relative paths inside `pricebookSourceFiles` and `storefrontSourceFiles` are resolved from the config file location.

If `--config` is omitted, the built-in default reducer config is used.

The published package does not include the repository-local `config/`, `files/`, `tmp/`, `scripts/`, or `test/` directories. Provide your own catalog XML input and config file when you run the plugin from an installed package.

### Troubleshooting

If `b2c catalog reduce` is not available after linking or installing the plugin:

```bash
b2c plugins
b2c help catalog reduce
```

If the command is still missing for a local checkout, rebuild the plugin and link it again:

```bash
npm install
npm run build
b2c plugins link /absolute/path/to/b2c-plugin-catalog-reducer
```

If you changed TypeScript sources locally, re-run `npm run build` before testing in `b2c` so the CLI loads the latest files from `dist/`.

If XML validation fails at runtime, inspect the reported schema error details for the failing output file. Validation does not depend on a system `xmllint` install.

## Repository-Local Usage

Run the reducer from the repository root:

```bash
npm run reduce -- -i ./catalog.xml -o ./catalog-reduced.xml -c ./catalog-reducer.json
```

Direct oclif command:

```bash
./bin/dev.js catalog reduce -i ./catalog.xml -o ./catalog-reduced.xml -c ./catalog-reducer.json
```

The repository-local wrappers run the same reducer workflow as `b2c catalog reduce`.

## Outputs

Each run writes:

- Catalog: `<output>.xml`
- Inventory: `<output>-inventory.xml`
- Pricebook: `<output>-pricebook.xml`

When a profile uses `pricebookSourceFiles`, the reducer writes one filtered pricebook file per configured source pricebook instead of a single generated pricebook file.

When a profile uses `storefrontSourceFiles`, the reducer writes one filtered storefront catalog file per configured source storefront. Each storefront output keeps the original catalog structure and removes only `category-assignment` entries for products that were not selected from the main catalog reduction.

## Example Config

Config files can live anywhere. The example below works as a standalone JSON config file.

```json
{
	"total": 1000,
	"master": 100,
	"productIds": ["ID1", "ID2"],
	"attributes": {
		"custom": [
			{ "id": "someAttribute", "count": 50 },
			{ "id": "someOtherAttribute", "value": "some value", "count": 100 }
		]
	},
	"onlineSiteIds": [],
	"pricebookRandomSeed": null,
	"pricebookSourceFiles": [],
	"storefrontSourceFiles": []
}
```

- `onlineSiteIds`: restricts online status to the listed site IDs. A configured site counts as online if the product has an explicit site-specific `<online-flag site-id="...">true</online-flag>` for it, or, when that site has no explicit override, if the global `<online-flag>` is `true` (mirroring SFCC's per-site attribute inheritance). The product is kept if at least one configured site is online. Leave empty (the default) to keep the prior behavior: a product is online if any online-flag (site-specific or global) is `true`.

## Examples

Config file from an arbitrary path:

```bash
npm run reduce -- -i ./catalog.xml -o ./catalog-reduced.xml -c ./configs/catalog-reducer.json
```

Quick local validation run:

```bash
npm run reduce -- -i files/source/puma-catalog.xml -o files/filtered/puma-test.xml -c ./config/test.json
```

Preview a reduction without writing any files:

```bash
npm run reduce -- -i files/source/puma-catalog.xml -o files/filtered/puma-test.xml -c ./config/test.json --dry-run
```

Puma source-pricebook profile:

```bash
npm run reduce -- -i files/source/puma-catalog.xml -o files/filtered/puma-config-check.xml -c ./config/puma.json
```

Benchmark fixture generation:

```bash
npm run reduce -- -i files/source/puma-catalog.xml -o files/source/puma-catalog-1000.xml -c ./config/fixture1000.json
```

Repeatable benchmarks:

```bash
node scripts/benchmark.js -c ./config/benchmark1000.json -i files/source/puma-catalog-1000.xml -o files/filtered/benchmark.xml -w 1 -r 5
```

## Validation

Run the core checks from the repository root:

```bash
npm run build
npm test
npm run lint
npm run test:coverage
node scripts/validate-output-integrity.js -s files/source/puma-catalog.xml -c files/filtered/puma-test-quality.xml -i files/filtered/puma-test-quality-inventory.xml -p files/filtered/puma-test-quality-pricebook.xml
```

The reducer validates generated XML against the bundled schemas in `xsd/`.

## Repository Layout

- `bin/`: root oclif entrypoints for development and built execution
- `src/commands/catalog/reduce.ts`: root oclif command wrapper for the reducer
- `src/lib/`: root command helpers
- `reducer.js`: CLI entry point
- `lib/`: parser, filter pipeline, XML generation, and validation helpers
- `config/`: repository-local profiles and benchmark configs
- `files/source/`: repository-local source XML inputs
- `files/filtered/`: repository-local generated sample outputs
- `test/`: test coverage for parser, filters, selectors, and XML validation
- `scripts/`: benchmarks and output-integrity checks
- `xsd/`: XML schemas

## Notes

- The reducer validates generated files after writing them.
- The parser expects `<catalog ...>` near the file header and falls back to scanning the full file when needed.
- Set `pricebookRandomSeed` to make generated pricebook values deterministic.
- The deprecated `singlePass` config field is ignored; all profiles use the multi-pass selector pipeline.
- The root `catalog reduce` command is a thin oclif wrapper around the reducer runtime.
- The published package does not include the repository-local `config/`, `files/`, `tmp/`, `scripts/`, or `test/` directories.
- The legacy `--project` / `-p` profile flag has been removed. Use `--config /path/to/file.json`.
- Product selections are cached in a `.catalog-reducer-cache/` directory next to the source catalog XML file, keyed by the file's mtime/size and the effective config. The cache is invalidated automatically when either changes; delete the directory (or pass `--no-cache`) to force a fresh parse.

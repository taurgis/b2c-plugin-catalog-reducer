# Catalog Reducer

Catalog Reducer generates smaller, representative Salesforce B2C Commerce catalog datasets from large source XML files.

It keeps product selection configurable, exposes a root oclif command for reduction workflows, writes derived inventory and pricebook XML outputs, and validates generated files against the bundled XSD schemas.

Repository-local fixtures and sample profiles under `files/` and `config/` are for local development and debugging. They are not part of the published package.

## Highlights

- Reduces large catalog XML files into smaller fixture datasets
- Supports preferred product IDs, master-product targets, attribute-driven selection, and filler products
- Writes catalog, inventory, and pricebook outputs in one run
- Supports generated or source-derived pricebook outputs
- Validates generated XML against the bundled catalog, inventory, and pricebook schemas
- Includes repeatable benchmark and output-integrity tooling

## Install

```bash
npm install
```

System requirements:

- `xmllint` must be available on `PATH` for XML schema validation

`npm install` bootstraps both the root CLI and the reducer runtime dependencies.

## Usage

Run the reducer from the repository root:

```bash
npm run reduce -- -i ./catalog.xml -o ./catalog-reduced.xml -c ./catalog-reducer.json
```

Direct oclif command:

```bash
./bin/dev.js catalog reduce -i ./catalog.xml -o ./catalog-reduced.xml -c ./catalog-reducer.json
```

Arguments:

- `-c`, `--config`: path to a JSON config file anywhere on disk
- `-i`, `--input`: source catalog XML file
- `-o`, `--output`: reduced catalog output file

Relative input and output paths are resolved from the directory where you invoke the CLI.

When `--config` is used, relative paths inside `pricebookSourceFiles` are resolved from the config file location.

If `--config` is omitted, the built-in default reducer config is used.

## Outputs

Each run writes:

- Catalog: `<output>.xml`
- Inventory: `<output>-inventory.xml`
- Pricebook: `<output>-pricebook.xml`

When a profile uses `pricebookSourceFiles`, the reducer writes one filtered pricebook file per configured source pricebook instead of a single generated pricebook file.

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
	"pricebookRandomSeed": null,
	"pricebookSourceFiles": [],
	"singlePass": false
}
```

## Examples

Config file from an arbitrary path:

```bash
npm run reduce -- -i ./catalog.xml -o ./catalog-reduced.xml -c ./configs/catalog-reducer.json
```

Quick local validation run:

```bash
npm run reduce -- -i files/source/puma-catalog.xml -o files/filtered/puma-test.xml -c ./config/test.json
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
node scripts/benchmark.js -c ./config/benchmark1000-legacy.json -i files/source/puma-catalog-1000.xml -o files/filtered/benchmark-legacy.xml -w 1 -r 5
node scripts/benchmark.js -c ./config/benchmark1000.json -i files/source/puma-catalog-1000.xml -o files/filtered/benchmark-single-pass.xml -w 1 -r 5
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
- Set `singlePass: true` to enable the single-pass selector on compatible profiles.
- The root `catalog reduce` command is a thin oclif wrapper around the reducer runtime.
- The published package does not include the repository-local `config/`, `files/`, `tmp/`, `scripts/`, or `test/` directories.
- The legacy `--project` / `-p` profile flag has been removed. Use `--config /path/to/file.json`.

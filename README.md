# Catalog Reducer

Catalog Reducer generates smaller, representative Salesforce B2C Commerce catalog datasets from large source XML files.

It keeps product selection configurable, writes derived inventory and pricebook XML outputs, and validates generated files against the bundled XSD schemas.

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

## Usage

Run the reducer from the repository root:

```bash
npm run reduce -- -i files/source/puma-catalog.xml -o files/filtered/puma-test.xml -p test
```

Arguments:

- `-i`, `--input`: source catalog XML file
- `-o`, `--output`: reduced catalog output file
- `-p`, `--project`: config profile name from `tmp/config/<profile>.json`

If `-p` is omitted, the default config is used.

## Outputs

Each run writes:

- Catalog: `<output>.xml`
- Inventory: `<output>-inventory.xml`
- Pricebook: `<output>-pricebook.xml`

When a profile uses `pricebookSourceFiles`, the reducer writes one filtered pricebook file per configured source pricebook instead of a single generated pricebook file.

## Example Config

Profiles live under `tmp/config/`.

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

Quick validation run:

```bash
npm run reduce -- -i files/source/puma-catalog.xml -o files/filtered/puma-test.xml -p test
```

Puma source-pricebook profile:

```bash
npm run reduce -- -i files/source/puma-catalog.xml -o files/filtered/puma-config-check.xml -p puma
```

Benchmark fixture generation:

```bash
npm run reduce -- -i files/source/puma-catalog.xml -o files/source/puma-catalog-1000.xml -p fixture1000
```

Repeatable benchmarks:

```bash
npm run benchmark -- -p benchmark1000-legacy -i files/source/puma-catalog-1000.xml -o files/filtered/benchmark-legacy.xml -w 1 -r 5
npm run benchmark -- -p benchmark1000 -i files/source/puma-catalog-1000.xml -o files/filtered/benchmark-single-pass.xml -w 1 -r 5
```

## Validation

Run the core checks from the repository root:

```bash
npm test
npm run lint
npm run test:coverage
npm run validate:output
```

The reducer validates generated XML against the bundled schemas in `tmp/xsd/`.

## Repository Layout

- `tmp/reducer.js`: CLI entry point
- `tmp/lib/`: parser, filter pipeline, XML generation, and validation helpers
- `tmp/config/`: reducer profiles and benchmark configs
- `tmp/files/source/`: source XML inputs
- `tmp/files/filtered/`: generated sample outputs
- `tmp/test/`: test coverage for parser, filters, selectors, and XML validation
- `tmp/scripts/`: benchmarks and output-integrity checks
- `tmp/xsd/`: XML schemas

## Notes

- The reducer validates generated files after writing them.
- The parser expects `<catalog ...>` near the file header and falls back to scanning the full file when needed.
- Set `pricebookRandomSeed` to make generated pricebook values deterministic.
- Set `singlePass: true` to enable the single-pass selector on compatible profiles.

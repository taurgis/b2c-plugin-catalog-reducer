# AGENTS.md

Agent guide for `b2c-plugin-catalog-reducer`.

## Purpose

This repository provides a catalog reducer for Salesforce B2C Commerce XML datasets.

The tool reduces large catalog exports into smaller, representative fixtures and writes matching inventory and pricebook outputs.

Tech stack:
- Node.js CommonJS CLI
- Root oclif command layer plus npm automation at the repository root
- XML processing and validation via `xml-flow`, `node-expat`, `xml-formatter`, and `xmllint`

## Key Paths

- `.github/agents/`: custom subagents for governed repo work
- `.github/instructions/`: repo workflow and subagent routing rules
- `.github/skills/`: reusable skills for plugin authoring and reducer maintenance
- `bin/`: root oclif entrypoints
- `src/commands/`: root oclif command implementations
- `src/lib/`: root wrapper helpers and command support code
- `reducer.js`: reducer CLI entry point
- `lib/`: parser, selection logic, XML output helpers
- `config/`: repository-local profiles and benchmark configs
- `test/`: reducer coverage and regression checks
- `scripts/`: benchmarks and output-integrity validation
- `files/`: repository-local source and generated fixture XML samples
- `xsd/`: XML schemas used for output validation

## Mandatory Pre-Step

- Before technical edits that depend on B2C CLI or plugin behavior, run the subagent `Official Docs Researcher` and incorporate relevant official references.
- Use the subagent `B2C DX Developer Tools Expert` when the task involves B2C CLI plugin architecture, oclif command design, or hook integration.

## Working Rules

- Keep documented commands and outputs aligned with what runs from the repository root today.
- Preserve reducer behavior when changing the root wrapper layer, especially product selection order, inventory and pricebook generation, and XML schema compatibility.
- Prefer small, focused diffs over broad restructuring.
- Do not mass-edit generated XML outputs under `files/filtered/` unless the task explicitly requires fixture updates.
- When changing validation or config behavior, keep examples tied to verified files in the repository.
- Treat `config/`, `files/`, and `tmp/` as repository-local development assets, not published package assets.
- Use explicit config file paths for CLI usage. Do not reintroduce `-p` profile mode.

## Build, Test, Validate

- Install deps: `npm install`
- Build root command layer: `npm run build`
- Run reducer with explicit config: `npm run reduce -- -i ./catalog.xml -o ./catalog-reduced.xml -c ./catalog-reducer.json`
- Run direct oclif command: `./bin/dev.js catalog reduce -i ./catalog.xml -o ./catalog-reduced.xml -c ./catalog-reducer.json`
- Run tests: `npm test`
- Run lint: `npm run lint`
- Coverage gate: `npm run test:coverage`
- CI-style validation: `npm run test:ci`
- Output integrity check: `node scripts/validate-output-integrity.js -s files/source/puma-catalog.xml -c files/filtered/puma-test-quality.xml -i files/filtered/puma-test-quality-inventory.xml -p files/filtered/puma-test-quality-pricebook.xml`
- Benchmarks: `node scripts/benchmark.js -c ./config/benchmark1000.json ...`

Validation guidance:
- Reducer logic or config changes: run `npm test`
- Root command wrapper changes: run `npm run build`, `npm run test:root`, and one representative reducer command
- Filter or output behavior changes: also run one representative reducer command and verify the expected catalog, inventory, and pricebook outputs
- Guidance-only or plugin-architecture changes: run targeted stale-reference searches and validate changed customization files for consistency

## Output Expectations

- Keep examples grounded in the reducer command surface documented in this repository.
- Document catalog, inventory, and pricebook outputs together, since they are produced as one workflow.
- Avoid introducing command examples that are not currently supported.
- Keep the root oclif command layer thin unless the task explicitly absorbs more reducer logic into `src/`.
- Keep packaged CLI guidance based on explicit config file paths rather than repository-local profile names.

## References

- B2C Developer Tooling docs:
  https://salesforcecommercecloud.github.io/b2c-developer-tooling/
- Extending the B2C CLI:
  https://salesforcecommercecloud.github.io/b2c-developer-tooling/guide/extending.html
- Third-party plugins:
  https://salesforcecommercecloud.github.io/b2c-developer-tooling/guide/third-party-plugins.html
- GitHub Copilot repository instructions:
  https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions

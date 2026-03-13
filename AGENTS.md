# AGENTS.md

Agent guide for `b2c-plugin-catalog-reducer`.

## Purpose

This repository provides a catalog reducer for Salesforce B2C Commerce XML datasets.

The tool reduces large catalog exports into smaller, representative fixtures and writes matching inventory and pricebook outputs.

Tech stack:
- Node.js CommonJS CLI
- Repository automation via npm scripts at the root
- XML processing and validation via `xml-flow`, `node-expat`, `xml-formatter`, and `xmllint`

## Key Paths

- `.github/agents/`: custom subagents for governed repo work
- `.github/instructions/`: repo workflow and subagent routing rules
- `.github/skills/`: reusable skills for plugin authoring and reducer maintenance
- `tmp/reducer.js`: reducer CLI entry point
- `tmp/lib/`: parser, selection logic, XML output helpers
- `tmp/config/`: reducer profiles and benchmark configs
- `tmp/test/`: reducer coverage and regression checks
- `tmp/scripts/`: benchmarks and output-integrity validation
- `tmp/files/`: source and generated fixture XML samples
- `tmp/xsd/`: XML schemas used for output validation

## Mandatory Pre-Step

- Before technical edits that depend on B2C CLI or plugin behavior, run the subagent `Official Docs Researcher` and incorporate relevant official references.
- Use the subagent `B2C DX Developer Tools Expert` when the task involves B2C CLI plugin architecture, oclif command design, or hook integration.

## Working Rules

- Keep documented commands and outputs aligned with what runs from the repository root today.
- Preserve reducer behavior when migrating logic, especially product selection order, inventory and pricebook generation, and XML schema compatibility.
- Prefer small, focused diffs over broad restructuring.
- Do not mass-edit generated XML outputs under `tmp/files/filtered/` unless the task explicitly requires fixture updates.
- When changing validation or config behavior, keep examples tied to verified files under `tmp/`.

## Build, Test, Validate

- Install deps: `npm install`
- Run reducer: `npm run reduce -- -i files/source/puma-catalog.xml -o files/filtered/puma-test.xml -p test`
- Run tests: `npm test`
- Run lint: `npm run lint`
- Coverage gate: `npm run test:coverage`
- CI-style validation: `npm run test:ci`
- Output integrity check: `npm run validate:output`
- Benchmarks: `npm run benchmark -- ...`

Validation guidance:
- Reducer logic or config changes: run `npm test`
- Filter or output behavior changes: also run one representative reducer command and verify the expected catalog, inventory, and pricebook outputs
- Guidance-only or plugin-architecture changes: run targeted stale-reference searches and validate changed customization files for consistency

## Output Expectations

- Keep examples grounded in the reducer command surface documented in this repository.
- Document catalog, inventory, and pricebook outputs together, since they are produced as one workflow.
- Avoid introducing command examples that are not currently supported.

## References

- B2C Developer Tooling docs:
  https://salesforcecommercecloud.github.io/b2c-developer-tooling/
- Extending the B2C CLI:
  https://salesforcecommercecloud.github.io/b2c-developer-tooling/guide/extending.html
- Third-party plugins:
  https://salesforcecommercecloud.github.io/b2c-developer-tooling/guide/third-party-plugins.html
- GitHub Copilot repository instructions:
  https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions

---
name: catalog-reducer-verification
description: 'Verification playbook for catalog reducer behavior changes, including run commands, output checks, and regression signals across catalog, inventory, and pricebook XML outputs under tmp/. Use after modifying reducer logic, filters, parser flow, or config-driven selection settings.'
license: MIT
compatibility: 'VS Code agent mode, GitHub Copilot coding agent, Node.js CLI workflows'
---

# Catalog Reducer Verification

Use this skill to verify behavior after changes to selection or output generation in the current reducer implementation under `tmp/`.

## When to Use This Skill

- After editing `tmp/reducer.js`, `tmp/lib/parser.js`, `tmp/lib/filterManager.js`, or `tmp/lib/filters/*`
- After changing selection configs in `tmp/config/*.json`
- Before finalizing a PR that changes filtering or output behavior
- When comparing migrated plugin behavior against the current reducer
- Not for: Non-functional text-only edits

## Prerequisites

- Dependencies installed with `cd tmp && npm install`
- One representative input XML available under `tmp/files/source/`

## Verification Workflow

1. Run the reducer with a realistic config:

```bash
cd tmp && node reducer.js -i files/source/puma-catalog.xml -o files/filtered/puma-test.xml -p test
```

2. Confirm all expected outputs exist:

- `files/filtered/puma-test.xml`
- `files/filtered/puma-test-inventory.xml`
- `files/filtered/puma-test-pricebook.xml`

3. Run the automated checks that match the change:

```bash
cd tmp && npm test
cd tmp && npm run validate:output
```

4. Sanity-check product selection counts and obvious schema regressions in generated files.
5. If behavior changed intentionally, summarize what changed and why.

## Fast Checks

```bash
cd tmp && OUTPUT=files/filtered/puma-test.xml
rg -n "<product\\s" "$OUTPUT" | wc -l
rg -n "<record\\s" "${OUTPUT%.xml}-inventory.xml" | wc -l
rg -n "<price-table\\s" "${OUTPUT%.xml}-pricebook.xml" | wc -l
```

Counts do not always need to be identical, but large mismatches indicate likely regressions.

## Regression Signals

- Output files missing after a successful process log
- Unexpectedly empty selection when config requests non-zero totals
- Duplicate or malformed product IDs in output XML
- Missing root XML namespaces for catalog, inventory, or pricebook files
- Validation failures from `tmp/lib/xmlSchemaValidator.js` or `xmllint`

## Reporting Template

- Command run:
  - `cd tmp && node reducer.js -i ... -o ... -p ...`
- Observed output files:
  - catalog: `...`
  - inventory: `...`
  - pricebook: `...`
- Notes:
  - selection behavior changes:
  - known limitations or follow-ups:

## References

- `tmp/AGENTS.md`
- `tmp/README.md`
- `tmp/package.json`
- `tmp/scripts/validate-output-integrity.js`
- https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-skills
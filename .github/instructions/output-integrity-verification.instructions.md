---
description: 'Require source-vs-filtered integrity verification to prevent transformation data loss'
applyTo: '**'
---

# Source vs Filtered Integrity Verification Requirement

## Mandatory Post-Change Step
- After every non-documentation repository modification, run a source-vs-filtered integrity check to confirm that transformed outputs do not lose selected product information.
- Documentation-only changes (for example under `.github/instructions/`, `.github/prompts/`, or `README.md`) do not require this integrity check.

## Required Verification Commands
1. Generate filtered outputs from the canonical full input:
   - `node reducer.js -i files/source/puma-catalog.xml -o files/filtered/puma-test-quality.xml -c config/test.json`
2. Validate source/output integrity relationships:
   - `node <<'NODE'`
   - `const fs = require('fs');`
   - `const files = {`
   - `  source: 'files/source/puma-catalog.xml',`
   - `  catalog: 'files/filtered/puma-test-quality.xml',`
   - `  inventory: 'files/filtered/puma-test-quality-inventory.xml',`
   - `  pricebook: 'files/filtered/puma-test-quality-pricebook.xml'`
   - `};`
   - ``
   - `const extract = (filePath, regex) => {`
   - `  const xml = fs.readFileSync(filePath, 'utf8');`
   - `  const ids = [];`
   - `  let match;`
   - `  while ((match = regex.exec(xml)) !== null) ids.push(match[1]);`
   - `  return ids;`
   - `};`
   - ``
   - `const sourceIds = extract(files.source, /<product\s+product-id="([^"]+)"/g);`
   - `const catalogIds = extract(files.catalog, /<product\s+product-id="([^"]+)"/g);`
   - `const inventoryIds = extract(files.inventory, /<record\s+product-id="([^"]+)"/g);`
   - `const pricebookIds = extract(files.pricebook, /<price-table\s+product-id="([^"]+)"/g);`
   - ``
   - `const asSet = values => new Set(values);`
   - `const setEq = (a, b) => a.size === b.size && [...a].every(id => b.has(id));`
   - `const hasDuplicates = values => new Set(values).size !== values.length;`
   - ``
   - `const sourceSet = asSet(sourceIds);`
   - `const catalogSet = asSet(catalogIds);`
   - `const inventorySet = asSet(inventoryIds);`
   - `const pricebookSet = asSet(pricebookIds);`
   - ``
   - `const catalogMissingFromSource = [...catalogSet].filter(id => !sourceSet.has(id));`
   - `if (catalogMissingFromSource.length > 0) {`
   - `  throw new Error('Filtered catalog contains IDs not present in source: ' + catalogMissingFromSource.slice(0, 20).join(', '));`
   - `}`
   - ``
   - `if (!setEq(inventorySet, catalogSet)) throw new Error('Inventory ID set does not match filtered catalog ID set.');`
   - `if (!setEq(pricebookSet, catalogSet)) throw new Error('Pricebook ID set does not match filtered catalog ID set.');`
   - ``
   - `if (hasDuplicates(catalogIds)) throw new Error('Filtered catalog has duplicate product IDs.');`
   - `if (hasDuplicates(inventoryIds)) throw new Error('Filtered inventory has duplicate product IDs.');`
   - `if (hasDuplicates(pricebookIds)) throw new Error('Filtered pricebook has duplicate product IDs.');`
   - ``
   - `console.log('Source-vs-filtered integrity checks passed.');`
   - `NODE`
3. Manual spot-check of 5 full products between source and filtered catalog:
   - Select five product IDs that exist in the filtered catalog.
   - For each sampled ID, inspect the full `<product ...>` structure in both source and filtered catalog files.
   - Confirm no product-level or nested attribute values are missing in the filtered product for that ID.
   - Record the sampled IDs and spot-check outcome in the change summary.

## Required Assertions
- All product IDs in the filtered catalog must exist in the source catalog.
- Filtered inventory product IDs must exactly match filtered catalog product IDs.
- Filtered pricebook product IDs must exactly match filtered catalog product IDs.
- Duplicate product IDs in filtered catalog, inventory, or pricebook are not allowed.
- For 5 sampled product IDs, full product-level and nested attribute values must be present in source and filtered catalog comparisons.
- XSD validation must pass for generated files (the reducer command enforces this via `xmllint`).

## Failure Handling
- Treat any failed assertion as a blocking issue.
- If this check cannot be executed for a non-documentation change, report it explicitly as skipped with a reason in the change summary.
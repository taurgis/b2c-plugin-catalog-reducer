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
   - `node scripts/validate-output-integrity.js -s files/source/puma-catalog.xml -c files/filtered/puma-test-quality.xml -i files/filtered/puma-test-quality-inventory.xml -p files/filtered/puma-test-quality-pricebook.xml`
3. Manual spot-check of 5 products between source and filtered catalog (semantic comparison only):
   - Select sampled IDs deterministically from the filtered catalog with:
   - `node -e "const fs=require('fs');const xml=fs.readFileSync('files/filtered/puma-test-quality.xml','utf8');const ids=[...xml.matchAll(/<product\s+product-id=\"([^\"]+)\"/g)].map(m=>m[1]);const unique=[...new Set(ids)].sort((a,b)=>a.localeCompare(b));console.log(unique.slice(0,5).join('\\n'));"`
   - For each sampled ID, inspect the source and filtered product semantically. Do not compare the full product as a raw XML string and do not compare raw reparsed object shapes directly.
   - Prefer editor/search inspection or a streaming helper for the source catalog. Avoid ad hoc `fs.readFileSync(..., 'utf8')` on the full source catalog during manual spot checks.
   - Optional readability helper for the filtered output only:
   - `xmllint --format files/filtered/puma-test-quality.xml > /tmp/puma-test-quality.formatted.xml`
   - Confirm at minimum that these values are preserved when present:
   - display-name values
   - custom-attribute IDs, site IDs, and values
   - image-group view types, variation values, and image paths
   - variation-attribute IDs and values
   - variant IDs and variation-group IDs
   - Treat missing or changed semantic values as failures.
   - Treat formatting-only differences, attribute-order differences, and equivalent parser wrapper or container-flattening differences as non-failures.
   - Raw XML string equality is not an acceptable comparison method.
   - Record the sampled IDs and a pass/fail result per ID in the change summary.

## Required Assertions
- All product IDs in the filtered catalog must exist in the source catalog.
- Filtered inventory product IDs must exactly match filtered catalog product IDs.
- Filtered pricebook product IDs must exactly match filtered catalog product IDs.
- Duplicate product IDs in filtered catalog, inventory, or pricebook are not allowed.
- For 5 deterministically sampled product IDs, semantic comparison finds no missing or changed product-level or nested values in the checked fields.
- Formatting-only differences (whitespace, line wrapping, attribute order) are explicitly non-failures.
- Equivalent parser wrapper or container-flattening differences are explicitly non-failures when the underlying values are preserved.
- The 5 sampled IDs and per-ID outcome must be documented in the change summary.
- XSD validation must pass for generated files (the reducer command enforces this via `xmllint`).

## Failure Handling
- Treat any failed assertion as a blocking issue.
- If a spot-check attempt fails due to raw-string comparison, rerun it using semantic comparison rules before reporting failure.
- If this check cannot be executed for a non-documentation change, report it explicitly as skipped with a reason in the change summary.

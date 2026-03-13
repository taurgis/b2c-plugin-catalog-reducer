---
name: catalog-reducer-filter-development
description: 'Guidance for adding or modifying product selection filters in the current catalog reducer under tmp/, while preserving ordering semantics, statistics, and XML compatibility. Use when implementing or reviewing changes in tmp/lib/filters, tmp/lib/filterManager.js, tmp/lib/parser.js, or config-driven selection behavior.'
license: MIT
compatibility: 'VS Code agent mode, GitHub Copilot coding agent, Node.js CommonJS projects'
---

# Catalog Reducer Filter Development

Use this skill to make safe, minimal changes to filter behavior in the current reducer implementation under `tmp/`.

## When to Use This Skill

- Adding a new filter in `tmp/lib/filters/`
- Modifying selection logic for existing filters
- Updating filter order or parser registration flow
- Extending statistics or config-driven behavior tied to filtering
- Planning how existing filter behavior should be preserved during plugin migration
- Not for: Pure documentation updates or output-only formatting tweaks

## Prerequisites

- Understand the current CLI flow in `tmp/reducer.js`
- Understand parsing and filter registration in `tmp/lib/parser.js`
- Read base behavior in `tmp/lib/filters/filter.js`

## Core Workflow

1. Confirm desired behavior from config and filter order.
2. Change the smallest possible filter surface.
3. Preserve deduplication and selection caps.
4. Keep master and variant expansion logic consistent.
5. Run a representative reduction command and verify all expected XML outputs are written.

## Ordering Constraints

Current execution order in the reducer test pipeline is:

1. `PreferredMasterProductsFilter`
2. `MasterFilter`
3. `PreferredProductsFilter`
4. `AttributeFilter`
5. `FillerProductsFilter`

Treat this as behavior-defining order. Reorder only when explicitly requested and document why.

## Implementation Guardrails

- Reuse existing filter contracts and statistics tracking where possible.
- Keep selected product IDs as the canonical dedupe source across filter passes.
- If changing config behavior, add safe defaults in `tmp/config/default.json`.
- Preserve compatibility with SFCC-style catalog, inventory, and pricebook XML structures.
- If the change is part of plugin migration work, keep the behavior grounded in the current reducer until the new contract is intentionally changed.

## Quick Reference

| File | Responsibility |
|------|----------------|
| `tmp/reducer.js` | CLI argument parsing and startup |
| `tmp/lib/parser.js` | Orchestrates parsing and output generation |
| `tmp/lib/filterManager.js` | Runs filters and tracks selection state |
| `tmp/lib/filters/*.js` | Concrete selection strategies |
| `tmp/config/*.json` | Selection targets and constraints |

## Verification Checklist

- Filter stops when intended
- No duplicate products are selected across filter passes
- Master expansion still tracks variants and variation groups correctly
- Catalog, inventory, and pricebook outputs are generated as expected
- Behavior changes are explained in terms of selection semantics

## References

- `tmp/AGENTS.md`
- `tmp/README.md`
- `tmp/test/filterPipeline.test.js`
- https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-skills
---
name: ts-node-cli-maintainability
description: 'Apply maintainability guardrails for TypeScript Node CLI code during the catalog reducer migration: small modules, explicit contracts, adapter boundaries, and automation-safe errors. Use when refactoring reducer logic into a plugin-oriented codebase.'
---

# TS Node CLI Maintainability

Use this skill when making structural changes while moving reducer behavior from `tmp/` into a plugin-oriented TypeScript or Node CLI codebase.

## When to use

- Refactoring large files.
- Extracting shared logic to reduce duplication.
- Defining adapter boundaries between existing reducer logic and new plugin commands.
- Improving long-term readability and testability.

## Core principles

1. Single responsibility per module.
2. Shared behavior in utilities, not copy/pasted blocks.
3. Behavior contracts must be explicit and tested.
4. Keep automation-facing surfaces stable.

## Repo contracts to preserve

- Reducer behavior should stay grounded in the current implementation under `tmp/` until deliberately changed.
- Product selection order and deduplication behavior are part of the observable contract.
- Inventory and pricebook side outputs must remain explainable and testable when logic is moved.

## Refactor playbook

1. Identify which reducer behavior is being migrated versus merely wrapped.
2. Extract focused utilities or adapters instead of copying large blocks wholesale.
3. Keep exported APIs narrow and typed.
4. Add or update tests before broadening scope.
5. Validate against the current reducer behavior in `tmp/` before declaring the migration safe.

## Checklist

- [ ] New utility improves reuse in at least two call sites.
- [ ] Refactor does not change documented command contract unexpectedly.
- [ ] Tests cover behavior not just code paths.
- [ ] Debug logging is opt-in and meaningful.
- [ ] Migration notes distinguish current reducer behavior from planned plugin behavior.

## References

- https://www.typescriptlang.org/tsconfig/strict
- https://nodejs.org/api/errors.html#systemerror
- https://nodejs.org/api/url.html
- https://oclif.io/docs/introduction
- https://docs.github.com/en/copilot/concepts/prompting/response-customization

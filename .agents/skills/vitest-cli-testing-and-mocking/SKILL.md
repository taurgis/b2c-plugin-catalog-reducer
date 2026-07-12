---
name: vitest-cli-testing-and-mocking
description: 'Write reliable Vitest tests for oclif command paths, migration adapters, and JSON/error contracts. Use when adding plugin command tests, refactoring mocks, or fixing flaky test isolation during the catalog reducer migration.'
---

# Vitest CLI Testing and Mocking

Use this skill when changing tests or behavior in a Vitest-based plugin layer for this repository.

## When to use

- Adding command-level tests for new flags or output modes.
- Updating mocks for plugin wrappers, B2C SDK calls, or migration adapters.
- Fixing flaky tests caused by stale module state.
- Verifying JSON contracts and failure behavior.

## Testing priorities

1. Test observable behavior first (output, errors, exits).
2. Mock external boundaries (network, browser, filesystem) consistently.
3. Keep tests isolated and deterministic.
4. Assert contract details, not incidental implementation.

## Repo patterns

- Keep plugin command tests close to commands or adapters when that structure exists.
- Mock side-effect modules at top-level with `vi.mock(...)`.
- Use per-test setup to reset mocks (`vi.clearAllMocks()`).
- Cover at least:
: happy path
: partial failure
: total failure
: `--json` contract shape
- If you are changing the current reducer under `tmp/`, use the native test suite there instead of forcing Vitest into unchanged files.

## Mocking guardrails

1. Remember `vi.mock` is hoisted.
2. For module-state issues, use `vi.resetModules()` deliberately.
3. Prefer `vi.mocked(fn)` for typed mock expectations.
4. Keep mock values minimal and scenario-focused.

## Checklist

- [ ] New behavior has at least one command-level test.
- [ ] JSON output is parsed and shape-asserted.
- [ ] Error paths are asserted with clear expectation.
- [ ] Tests do not rely on network, real browser, or OS keychain.
- [ ] Migration tests state whether they cover current reducer behavior or new plugin wrappers.

## References

- https://vitest.dev/api/vi.html#vi-mock
- https://vitest.dev/api/vi.html#vi-resetmodules
- https://vitest.dev/guide/mocking
- https://oclif.io/docs/testing

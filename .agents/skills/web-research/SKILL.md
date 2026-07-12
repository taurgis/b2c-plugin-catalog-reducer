---
name: web-research
description: 'Bonsai-backed official documentation and web research workflow. Use before technical changes that depend on platform behavior, when fetching documentation or web pages, when listing/pruning the local research cache, or when importing manually gathered notes.'
license: Forward Proprietary
compatibility: VS Code 1.x+, GitHub Copilot
metadata:
  version: '3.1.0'
---

# Web Research Skill

Use Bonsai as the cache-first research path for official documentation and web content. Prefer current official sources, keep research reusable, and avoid direct one-off web fetches when Bonsai can capture the same page.

## Invocation

Always run Bonsai through the published npm package:

```bash
npx @taurgis/bonsai <command> [flags]
```

Add `--json` when you need machine-readable output for agent callers.

If you are operating under a read-only/plan-mode harness, add `--read-only` (alias `--plan`) to every Bonsai call, or export `BONSAI_READ_ONLY=1` (or `BONSAI_PLAN_MODE=1`) once for the session. Fetches still run and return content normally; nothing is written to the local cache or config until the harness leaves plan mode. `import`, `config set`/`unset`, and `prune` all honor it too — see "Read-only / Plan Mode" below.

## Required Pre-Step

Before creating, updating, refactoring, scaffolding, or deleting technical content, verify relevant current official documentation in the same task.

When you do not yet know the official URL, discover it with your native web/search tools first. Once you have a URL, capture it through Bonsai:

```bash
npx @taurgis/bonsai <official-url> --format detailed
```

For agent callers that need structured output:

```bash
npx @taurgis/bonsai <official-url> --format detailed --json
```

## Source Rules

- Prefer official vendor docs, standards, API references, SDK docs, release notes, changelogs, and security advisories.
- Include official source URLs when the change relies on platform behavior or standards.
- Use `--tier stable`, `--tier standard`, or `--tier volatile` when the source class is clear.
- Treat volatile sources as needing fresh validation before trusting them.
- Do not use the retired manual `artifacts/online-research/` protocol for new research.

## Fetch Rules

Use `--format compressed` for context-budgeted reading and `--format detailed` for exact technical details, links, tables, and code examples.

Use `--rendered` when static extraction is incomplete or the page is an SPA:

```bash
npx @taurgis/bonsai <official-url> --rendered --format detailed
```

Never reach for direct `WebFetch` or `WebSearch` to retrieve a specific page when Bonsai can fetch it. Bonsai returns reusable Markdown and keeps it cached for future agents.

## Manual Fallbacks

If direct web access was unavoidable because of authentication, browser interaction, or a tool constraint, import the result into Bonsai before returning.

Single-source import:

```bash
npx @taurgis/bonsai import <url> --file path/to/notes.md
```

Stdin import:

```bash
echo "# My Synthesis Note" | npx @taurgis/bonsai import <url> --stdin
```

Multi-source synthesis:

```bash
npx @taurgis/bonsai import \
  --topic "<descriptive topic>" \
  --source-url <url1> \
  --source-url <url2> \
  --file path/to/synthesized-notes.md
```

## Cache Operations

Check status without fetching:

```bash
npx @taurgis/bonsai status <url>
```

Inspect stored metadata:

```bash
npx @taurgis/bonsai inspect <url>
```

List cached entries by metadata:

```bash
npx @taurgis/bonsai list --tags node
```

Preview pruning before deleting:

```bash
npx @taurgis/bonsai prune --older-than 90d --dry-run
npx @taurgis/bonsai prune --older-than 90d --yes
```

## Read-only / Plan Mode

Bonsai supports a global `--read-only` flag (alias `--plan`), also honored via the `BONSAI_READ_ONLY`/`BONSAI_PLAN_MODE` environment variables, that blocks all filesystem writes and deletes (cache persistence, config writes, `prune` deletions) while still allowing network fetches to run:

- Research fetches still hit the network and return content normally; they just skip writing the result to the local cache.
- `import` previews the write and reports `dryRun: true` instead of persisting.
- `prune` treats `--read-only` like an implicit dry run; combining it with `--yes` is rejected.

Composition is OR: once read-only mode is active (flag or either env var), there is no per-call way to force writes back on. Use this whenever the calling agent itself is confined to a read-only/plan mode, so research stays possible without violating that constraint.

## When This Does Not Apply

- No technical content or web content is involved.
- You already fetched and applied current official docs in the current task.
- The request is a trivial typo or formatting fix that does not involve platform behavior.
- `npx @taurgis/bonsai` is unavailable in the environment; use the best available official-source workflow and import notes later.

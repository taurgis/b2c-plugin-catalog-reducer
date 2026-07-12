<!-- GENERATED: forward-nexus ide-sync -->

Source: `.github/instructions/web-research.instructions.md`

# Web Research Requirement

## Mandatory Pre-Step

- Verify the relevant current official documentation **in the same task** before creating, updating, refactoring, scaffolding, or deleting technical content.
- Apply what you find — cite official source URLs when the change relies on platform behavior or standards.
- Research is the requirement; how you run it scales with scope (below). Training-data knowledge never satisfies this — only docs fetched in the current task do.

## Choose How to Research by Scope

- **Minor research — run it inline.** For a single known page, one platform, or a quick flag/API/version check, the main agent invokes the **web-research** skill directly. A separate subagent is not required.
- **Extensive research — delegate to a subagent.** For multiple sources or platforms, unfamiliar territory, broad audits, or anything that produces verbose output you do not want in the main context, run the **Official Docs Researcher** subagent and apply its findings.
- The main agent may always use the **web-research** skill directly — choose the subagent to isolate large research, not because inline research is disallowed.
- When unsure, start inline and escalate to the subagent once the work spans several sources.

## Shared Cache

- **Invocation**: Run Bonsai as `npx @taurgis/bonsai ...`.
- **URL discovery**: When you do not yet know the official URL, discover it with your native web/search tools, then fetch the page through Bonsai so it is cached for future agents.
- If Bonsai is configured for project storage and `.bonsai/research/` is not ignored by git, treat those cache artifacts as intentional shared project files. It is OK to check them in, and agents must not delete them as incidental generated output without an explicit request.
- Re-running on a recent topic is cheap — research the topic rather than skipping it to "save" a fetch.
- If you are operating under a read-only/plan-mode harness, add `--read-only` (alias `--plan`) to Bonsai calls, or rely on `BONSAI_READ_ONLY`/`BONSAI_PLAN_MODE` if the harness sets it — fetches still run, but nothing is persisted to the local cache or config.

## When Not to Use

- No technical content is being modified (purely editorial changes).
- You already fetched and applied official docs **in the current task**. Training-data knowledge does not satisfy this — only docs fetched in the same task do.
- The request is too simple to warrant research (typo, lint fix not involving platform behavior).

## Examples

- ✅ Confirming one platform's current flag or frontmatter field before a small edit → run the web-research skill inline.
- ✅ Comparing conventions across several platforms, or auditing/refactoring source broadly → delegate to the Official Docs Researcher subagent.
- ✅ Before editing instructions, prompts, agents, skills, workflows, or docs — reading source code does not replace checking current platform guidance.
- ✅ Include official source URLs when the change references platform behavior or standards.
- ❌ Don't modify technical content without researching first, and don't treat cached or training knowledge as equivalent — official guidance evolves and must be verified per task.

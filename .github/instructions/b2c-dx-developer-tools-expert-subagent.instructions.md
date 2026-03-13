---
description: 'Require B2C DX Developer Tools Expert for B2C CLI, oclif plugin, and catalog reducer migration requests'
applyTo: '**'
---

# B2C DX Developer Tools Expert Requirement

## Mandatory Pre-Step

Before implementation work, evaluate whether the request needs expert guidance on Salesforce B2C Developer Tooling, oclif plugin architecture, or the catalog reducer migration path in this repository.

## Trigger Conditions

Run the **B2C DX Developer Tools Expert** subagent when any of the following is true:

1. The request asks for B2C CLI plugin design, oclif command structure, plugin installation/linking behavior, hook usage, or command namespace planning.
2. The request asks for migration guidance from the current reducer implementation under `tmp/` into the target B2C Developer Tooling plugin.
3. The request requires trade-off advice across B2C CLI architecture, reducer behavior preservation, and delivery safety.

## Required Action

When a trigger condition is met:

1. Run the **B2C DX Developer Tools Expert** subagent before writing or editing implementation artifacts.
2. Use the subagent output to shape implementation decisions and validation steps.
3. Include subagent evidence in the final response.

## Relationship to Other Governance Instructions

This instruction is additive and does not replace existing governance requirements.

1. Continue to follow `.github/instructions/pm-ba-subagent-research.instructions.md` for PM, BA, Senior QA Engineer, and Official Docs requirements.
2. Continue to follow `.github/instructions/repo-research.instructions.md` before modifying guidance or making technical claims that depend on platform behavior.
3. Prefer official B2C Developer Tooling documentation when subagent advice and repository assumptions diverge.

## Binary Compliance Expectations

This requirement passes only if one of the following is true:

1. Trigger conditions are not met and the response states that B2C DX Developer Tools Expert was not required.
2. Trigger conditions are met and:
   - B2C DX Developer Tools Expert was invoked, and
   - Its output was used in the recommendation or implementation plan, and
   - The final response includes subagent evidence.

## When This Is Not Required

Skip B2C DX Developer Tools Expert invocation when all of the following are true:

1. The task is purely editorial with no B2C CLI, plugin, or reducer migration implications.
2. The task is read-only research or file discovery with no implementation recommendation requested.
3. The task does not ask for B2C Developer Tooling decisions, oclif guidance, or reducer-to-plugin trade-offs.

## Escalation Path

If it is unclear whether a request requires B2C DX Developer Tools Expert, or if subagent outputs conflict materially with other required guidance:

1. Escalate to the user with the exact ambiguity or conflict.
2. Provide the safest feasible fallback recommendation and label assumptions.
3. Do not present unresolved conflicts as confirmed conclusions.

## References

- `.github/agents/b2c-dx-developer-tools-expert.agent.md`
- `.github/instructions/pm-ba-subagent-research.instructions.md`
- `.github/instructions/repo-research.instructions.md`
- https://salesforcecommercecloud.github.io/b2c-developer-tooling/
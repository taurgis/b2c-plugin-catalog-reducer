---
description: 'Require PM, BA, Senior QA Engineer, and Official Docs research for governed changes'
applyTo: '**'
---

# PM, BA, Senior QA Engineer, and Official Docs Research Requirement

## Mandatory Pre-Step
- On every request, run the **Project Manager** subagent and the **Business Analyst** subagent.
- Use their outputs to provide research-backed recommendations before executing implementation work.
- Run the **Senior QA Engineer** subagent when any of the following is true:
	- The task edits `.github/agents/**` or `.github/instructions/**`.
	- The task spans more than one file.
	- The task introduces or changes acceptance criteria, quality gates, or risk controls.
- Run the **Official Docs Researcher** subagent before creating, updating, refactoring, scaffolding, or deleting technical guidance artifacts.
- Run **Official Docs Researcher** before audits when the audit is intended to produce technical recommendations that may influence repository changes.
- This includes updates to `.github/agents/**`, `.github/instructions/**`, `.github/skills/**`, workflows, prompts, docs, and implementation guidance files.

## Output Expectations
- Include clear planning recommendations from the Project Manager perspective (scope, sequencing, risks, and milestones).
- Include clear requirements and analysis recommendations from the Business Analyst perspective (problem framing, assumptions, acceptance criteria, and open questions).
- Include verification recommendations from the Senior QA Engineer perspective (coverage approach, key test cases, severity risks, and go/no-go factors) when Senior QA Engineer is invoked.
- Include official-source recommendations from Official Docs Researcher when technical claims depend on platform behavior or standards.
- Reconcile any conflicts between PM and BA recommendations, state the chosen approach, and resolve trade-offs by prioritizing user-stated requirements first, then feasibility/risk, then delivery speed; if requirements are ambiguous or unsafe, ask clarifying questions and default to the safest feasible option.
- Document the final reconciled recommendation and trade-offs in the response.

## Required Reconciliation Block

When this instruction applies, include a concise block with these headings:

1. `PM recommendations`
2. `BA recommendations`
3. `Senior QA Engineer recommendations` (if invoked)
4. `Official Docs Researcher recommendations` (if invoked)
5. `Conflicts and trade-offs`
6. `Chosen approach`
7. `Assumptions and open questions`

When subagents are invoked, also include:

8. `Subagent evidence` (which subagents ran and where their outputs were used)

## When Not Required

Skip PM and BA subagent invocation when **all** of the following are true:
- The task is fully specified with unambiguous acceptance criteria (no scope decision is open).
- The change is single-file or confined to a well-defined implementation unit with no cross-phase dependencies.
- The task is a correction to existing work (e.g., fixing a typo, updating a URL, reverting a value) with no new scope introduced.
- No new risks, sequencing decisions, or architectural trade-offs arise from the change.

Skip Senior QA Engineer invocation when the task is exempt above and does not modify quality gates, acceptance criteria, or governance policies.

Skip Official Docs Researcher invocation when **any** of the following is true:
- No technical content is being modified (for example, spelling or grammar fixes only).
- The task is read-only and no repository files are modified.
- Official documentation has already been incorporated in the current task and no new technical claims are introduced.

Examples of tasks that are exempt:
- "Set `draft: true` on this front matter field."
- "Fix the broken internal link in this Markdown file."
- "Add the missing `url` field to this content file."

Examples of tasks that always require PM and BA research:
- New phase planning or plan updates.
- Architecture decisions (e.g., choosing a redirect mechanism, adding a new dependency).
- Scope changes that affect multiple phases or have SEO/URL implications.
- Any task where requirements are ambiguous or contradict existing plan decisions.

Examples of tasks that require Senior QA Engineer research:
- Audits or updates to `.github/agents/**` or `.github/instructions/**`
- Changes introducing new validation requirements, release gates, or compliance checklists
- Multi-file governance updates where consistency and regression risk must be assessed

Examples of tasks that require Official Docs Researcher:
- Editing instructions, prompts, agents, skills, workflows, or implementation guidance docs
- Expanding scope to a new platform or tool not covered by previous research
- Making technical claims about platform behavior, standards, or feature support

## Escalation Path

If required subagents are unavailable, outputs conflict materially, official documentation is insufficient, or evidence is incomplete:

1. Escalate to the user with a concise blocker summary.
2. Provide the safest feasible fallback and clearly label assumptions.
3. Do not present unresolved conflicts as confirmed conclusions.

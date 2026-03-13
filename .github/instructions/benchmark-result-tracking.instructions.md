---
description: 'Require puma-catalog benchmark tracking only for file-processing plugin code changes'
applyTo: '**'
---

# Benchmark Result Tracking Requirement

## Mandatory Post-Change Step
- Run the full-input benchmark only when the change modifies actual plugin or reducer code that can affect file-processing behavior, runtime I/O/path resolution, selection logic, XML generation, or schema validation.
- Benchmark-required change areas include:
  - `reducer.js`
  - `src/commands/**`
  - `src/lib/**`
  - `lib/**`
  - `xsd/**`
- Benchmark-skipped change areas include:
  - documentation and guidance files such as `README.md`, `.github/instructions/**`, `.github/prompts/**`, and `AGENTS.md`
  - repository-only scripts such as `scripts/**`
  - package metadata and repo tooling changes such as `package.json`, lockfiles, lint config, test config, and workflow files, unless they also change file-processing runtime behavior
- When all modified files fall in skipped areas, do not run benchmarks and do not add a skipped benchmark entry.

## Mandatory Pre-Step: Detect Active System
- Always detect the active system before running any benchmark command or writing benchmark results.
- Capture at least these fields first:
  - hostname: `hostname`
  - model identifier and chip/memory: `system_profiler SPHardwareDataType | rg "Model Identifier|Chip|Memory"`
  - arch: `uname -m`
  - OS version/build: `sw_vers -productVersion && sw_vers -buildVersion`
  - Node.js and npm versions: `node -v && npm -v`
- Build a stable `device-id` and use it in the filename pattern `benchmark-results.<device-id>.puma.md`.
- Example filename: `.github/instructions/benchmark-results.macmini8,1-intel-i3-16gb.puma.md`

## Required Benchmark Commands
- Legacy selector mode:
  - `node scripts/benchmark.js -c config/benchmark1000-legacy.json -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-legacy-nodeexpat.xml -w 1 -r 5`
- Single-pass selector mode:
  - `node scripts/benchmark.js -c config/benchmark1000.json -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-single-nodeexpat.xml -w 1 -r 5`

## Required Tracking File Update
- Append a new entry to `.github/instructions/benchmark-results.<device-id>.puma.md` for each profile run.
- Include all of the following fields:
  - UTC timestamp
  - git commit and branch
  - device ID (linked to a device profile entry with full specs)
  - implementation variant (use `node-expat`)
  - Node.js version and npm version
  - config file path
  - benchmark command
  - warm-up and measured run counts
  - min, max, mean, median (p50), p95 timings in milliseconds
  - short note about what changed
- Update the ASCII trend section in the same file using the latest measured values (lower is better).
- If the per-system file does not exist yet, create it first with the same table structure used by existing benchmark history files.

## Consistency Rules
- Keep input fixed to `files/source/puma-catalog.xml` for all tracked entries.
- Keep `-w 1 -r 5` unless an explicit change request says otherwise.
- If a benchmark-required change cannot complete a full run, still update `.github/instructions/benchmark-results.<device-id>.puma.md` with a skipped entry and a clear reason.
- If a run is intentionally interrupted after partial measured runs, record the partial sample count and mark the entry as `partial` in the change note.
- Never record results in a file belonging to a different machine.

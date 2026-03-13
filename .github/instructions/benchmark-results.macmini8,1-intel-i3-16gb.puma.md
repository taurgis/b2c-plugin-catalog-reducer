# Puma Benchmark History - macmini8,1-intel-i3-16gb

This file tracks benchmark history for the mandatory full-input benchmark run against `files/source/puma-catalog.xml` on device `macmini8,1-intel-i3-16gb`.

## Active Baseline
- Source input: `files/source/puma-catalog.xml`
- Implementation variant: `node-expat`
- Warm-up runs: `1`
- Measured runs: `5` target (or explicitly logged partial when interrupted)
- Node.js: `v22.21.1`
- npm: `11.6.2`
- Baseline reset reason: single-pass selector removed; `benchmark1000` now tracks the only supported multi-pass selector

## Device Profile

| Device ID | Hostname | Model ID | Arch | CPU | Cores | Memory | OS |
| --- | --- | --- | --- | --- | ---: | --- | --- |
| macmini8,1-intel-i3-16gb | Mac mini van Thomas | Macmini8,1 | x86_64 | Intel(R) Core(TM) i3-8100B CPU @ 3.60GHz | 4 | 16 GB | macOS 15.7.3 (24G419) |

## Result Log

| Timestamp (UTC) | Commit | Branch | Device ID | Variant | Node.js | npm | Profile | Config File | Warm-up | Measured | Min ms | Max ms | Mean ms | Median p50 ms | P95 ms | Command | Change Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 2026-03-13T14:00:50Z | 32d6b5b | main | macmini8,1-intel-i3-16gb | node-expat | v22.21.1 | 11.6.2 | benchmark1000 | `config/benchmark1000.json` | 1 | 5 | 106119.05 | 124275.51 | 112060.80 | 109924.32 | 124285.62 | `node scripts/benchmark.js -c config/benchmark1000.json -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-nodeexpat.xml -w 1 -r 5` | Streamed compact source-pricebook writes and introduced injectable silent runtime logging/progress so benchmark runs measure parser work without reducer noise. |
| 2026-03-13T13:24:22Z | dcb3fde | main | macmini8,1-intel-i3-16gb | node-expat | v22.21.1 | 11.6.2 | benchmark1000 | `config/benchmark1000.json` | 1 | 5 | 117295.93 | 137979.66 | 127500.76 | 128043.71 | 138110.04 | `node scripts/benchmark.js -c config/benchmark1000.json -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-nodeexpat.xml -w 1 -r 5` | Fixed the preferred-pass filler-capture runtime-state bug and added regression coverage for the no-standalone-filler path. |
| 2026-03-13T12:39:46Z | fd793c3 | main | macmini8,1-intel-i3-16gb | node-expat | v22.21.1 | 11.6.2 | benchmark1000 | `config/benchmark1000.json` | 1 | 5 | 114235.00 | 161297.14 | 142587.42 | 145760.45 | 161329.71 | `node scripts/benchmark.js -c config/benchmark1000.json -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-nodeexpat.xml -w 1 -r 5` | Extracted selection planning/execution out of `parser.js`, removed duplicated selection-config guards, and replaced filler filter class-name coupling with an explicit filter contract. |
| 2026-03-13T11:43:06Z | fabbb04 | main | macmini8,1-intel-i3-16gb | node-expat | v22.21.1 | 11.6.2 | benchmark1000 | `config/benchmark1000.json` | 1 | 5 | 107144.51 | 166133.56 | 128923.72 | 119789.32 | 166161.55 | `node scripts/benchmark.js -c config/benchmark1000.json -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-nodeexpat.xml -w 1 -r 5` | Removed single-pass selector support, standardized all configs on multi-pass filtering, and simplified benchmarking to one canonical benchmark. Baseline reset: `benchmark1000` now measures multi-pass only. |
| 2026-03-13T10:39:28Z | 6135c83 | main | macmini8,1-intel-i3-16gb | node-expat | v22.21.1 | 11.6.2 | benchmark1000-legacy | `config/benchmark1000-legacy.json` | 1 | 5 | 161074.29 | 247765.27 | 207285.97 | 208574.35 | 247765.93 | `node scripts/benchmark.js -c config/benchmark1000-legacy.json -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-legacy-nodeexpat.xml -w 1 -r 5` | Removed legacy `-p` profile mode, switched CLI and benchmark tooling to explicit config-file paths, and moved repo-only benchmark/output-integrity workflows out of the shipped package surface |
| 2026-03-13T10:39:28Z | 6135c83 | main | macmini8,1-intel-i3-16gb | node-expat | v22.21.1 | 11.6.2 | benchmark1000 | `config/benchmark1000.json` | 1 | 5 | 184208.82 | 263051.79 | 225353.43 | 235015.24 | 263066.75 | `node scripts/benchmark.js -c config/benchmark1000.json -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-single-nodeexpat.xml -w 1 -r 5` | Removed legacy `-p` profile mode, switched CLI and benchmark tooling to explicit config-file paths, and moved repo-only benchmark/output-integrity workflows out of the shipped package surface |
| 2026-03-06T17:00:24Z | 0293201 | master | macmini8,1-intel-i3-16gb | node-expat | v22.21.1 | 11.6.2 | benchmark1000-legacy | `config/benchmark1000-legacy.json` | 1 | 5 | 94587.30 | 109389.88 | 101006.25 | 100059.32 | 109454.56 | `npm run benchmark -- -p benchmark1000-legacy -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-legacy-nodeexpat.xml -w 1 -r 5` | Reduced parser/filter hot-path overhead: optimized streaming node construction, removed per-product shouldSkip calls, and deduplicated master checks in filler capture flow |
| 2026-03-06T17:00:24Z | 0293201 | master | macmini8,1-intel-i3-16gb | node-expat | v22.21.1 | 11.6.2 | benchmark1000 | `config/benchmark1000.json` | 1 | 5 | 95663.49 | 112202.78 | 105491.83 | 108783.47 | 112206.02 | `npm run benchmark -- -p benchmark1000 -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-single-nodeexpat.xml -w 1 -r 5` | Reduced parser/filter hot-path overhead: optimized streaming node construction, removed per-product shouldSkip calls, and deduplicated master checks in filler capture flow |
| 2026-03-06T15:30:26Z | 646477a | master | macmini8,1-intel-i3-16gb | node-expat | v22.21.1 | 11.6.2 | benchmark1000-legacy | `config/benchmark1000-legacy.json` | 1 | 5 | 103758.68 | 111834.72 | 107912.50 | 107307.07 | 111870.48 | `npm run benchmark -- -p benchmark1000-legacy -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-legacy-nodeexpat.xml -w 1 -r 5` | XML formatting migrated to xmllint-first with fallback; beautify now mandatory for all generated XML files |
| 2026-03-06T15:30:26Z | 646477a | master | macmini8,1-intel-i3-16gb | node-expat | v22.21.1 | 11.6.2 | benchmark1000 | `config/benchmark1000.json` | 1 | 5 | 101675.18 | 119184.56 | 109276.70 | 109186.12 | 119185.34 | `npm run benchmark -- -p benchmark1000 -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-single-nodeexpat.xml -w 1 -r 5` | XML formatting migrated to xmllint-first with fallback; beautify now mandatory for all generated XML files |
| 2026-03-06T14:45:10Z | 82dff22 | master | macmini8,1-intel-i3-16gb | node-expat | v22.21.1 | 11.6.2 | benchmark1000-legacy | `config/benchmark1000-legacy.json` | 1 | 3 | 358808.79 | 388122.62 | 374798.17 | 377688.69 | 388157.67 | `npm run benchmark -- -p benchmark1000-legacy -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-legacy-nodeexpat.xml -w 1 -r 5` | Baseline reset after node-expat migration; partial entry accepted (interrupted after 3 measured runs) |
| 2026-03-06T14:07:39Z | f2284ab | master | macmini8,1-intel-i3-16gb | node-expat | v22.21.1 | 11.6.2 | benchmark1000-legacy | `config/benchmark1000-legacy.json` | 1 | 5 | 106438.06 | 123402.62 | 114900.21 | 116232.55 | 123413.20 | `npm run benchmark -- -p benchmark1000-legacy -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-legacy.xml -w 1 -r 5` | Historical expat benchmark restored from earlier tracked run |
| 2026-03-06T14:45:10Z | 82dff22 | master | macmini8,1-intel-i3-16gb | node-expat | v22.21.1 | 11.6.2 | benchmark1000 | `config/benchmark1000.json` | 1 | skipped | skipped | skipped | skipped | skipped | skipped | `npm run benchmark -- -p benchmark1000 -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-single-nodeexpat.xml -w 1 -r 5` | Baseline reset companion entry marked skipped by request after establishing migration slowdown |

## ASCII Trend (Mean ms, lower is better)

Scale: each `#` is about 10,000 ms of mean runtime.

Baseline reset note: the 2026-03-13T11:43:06Z `benchmark1000` entry is the new canonical multi-pass-only benchmark after single-pass selector removal. Earlier `benchmark1000` entries below are historical single-pass data and are not directly comparable.

### benchmark1000 (current multi-pass only)
- 2026-03-13T14:00:50Z | 112060.80 ms | ###########
- 2026-03-13T13:24:22Z | 127500.76 ms | #############
- 2026-03-13T12:39:46Z | 142587.42 ms | ##############
- 2026-03-13T11:43:06Z | 128923.72 ms | #############

### benchmark1000-legacy (historical multi-pass)
- 2026-03-13T10:39:28Z | 207285.97 ms | #####################
- 2026-03-06T17:00:24Z | 101006.25 ms | ##########
- 2026-03-06T15:30:26Z | 107912.50 ms | ###########
- 2026-03-06T14:45:10Z | 374798.17 ms | #####################################
- 2026-03-06T14:07:39Z | 114900.21 ms | ###########

### benchmark1000 (historical single-pass)
- 2026-03-13T10:39:28Z | 225353.43 ms | #######################
- 2026-03-06T17:00:24Z | 105491.83 ms | ###########
- 2026-03-06T15:30:26Z | 109276.70 ms | ###########

## Update Template

Copy a row and update all fields after each benchmark-required repository modification:

| Timestamp (UTC) | Commit | Branch | Device ID | Variant | Node.js | npm | Profile | Config File | Warm-up | Measured | Min ms | Max ms | Mean ms | Median p50 ms | P95 ms | Command | Change Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| YYYY-MM-DDTHH:MM:SSZ | <short-sha> | <branch> | macmini8,1-intel-i3-16gb | node-expat | <node-version> | <npm-version> | benchmark1000 | `config/benchmark1000.json` | 1 | 5 | <min> | <max> | <mean> | <median> | <p95> | `node scripts/benchmark.js -c config/benchmark1000.json -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-nodeexpat.xml -w 1 -r 5` | <what changed> |
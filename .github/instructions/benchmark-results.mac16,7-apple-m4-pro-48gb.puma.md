# Puma Benchmark History - mac16,7-apple-m4-pro-48gb

This file tracks benchmark history for the mandatory full-input benchmark run against `files/source/puma-catalog.xml` on device `mac16,7-apple-m4-pro-48gb`.

## Active Baseline
- Source input: `files/source/puma-catalog.xml`
- Implementation variant: `node-expat`
- Warm-up runs: `1`
- Measured runs: `5` target (or explicitly logged partial when interrupted)
- Node.js: `v22.22.0`
- npm: `10.9.4`
- Baseline reset reason: first per-system benchmark tracking entry for this machine

## Device Profile

| Device ID | Hostname | Model ID | Arch | CPU | Cores | Memory | OS |
| --- | --- | --- | --- | --- | ---: | --- | --- |
| mac16,7-apple-m4-pro-48gb | Thomass-MacBook-Pro.local | Mac16,7 | arm64 | Apple M4 Pro | 14 | 48 GB | macOS 26.2 (25C56) |

## Result Log

| Timestamp (UTC) | Commit | Branch | Device ID | Variant | Node.js | npm | Profile | Config File | Warm-up | Measured | Min ms | Max ms | Mean ms | Median p50 ms | P95 ms | Command | Change Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 2026-03-07T06:32:21Z | 881837b | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000-legacy | `config/benchmark1000-legacy.json` | 1 | 5 | 30448.45 | 30777.62 | 30578.50 | 30500.98 | 30786.19 | `npm run benchmark -- -p benchmark1000-legacy -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-legacy-nodeexpat.xml -w 1 -r 5` | Reintroduced fast-path serialization for `beautify: false`; parser now skips expensive XML pretty-formatting while preserving default formatted output when beautify is unset |
| 2026-03-07T06:32:21Z | 881837b | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000 | `config/benchmark1000.json` | 1 | 5 | 30504.37 | 31346.75 | 30760.56 | 30668.75 | 31356.62 | `npm run benchmark -- -p benchmark1000 -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-single-nodeexpat.xml -w 1 -r 5` | Reintroduced fast-path serialization for `beautify: false`; parser now skips expensive XML pretty-formatting while preserving default formatted output when beautify is unset |
| 2026-03-07T07:25:24Z | 1c04a72 | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000-legacy | `config/benchmark1000-legacy.json` | 1 | 5 | 30441.80 | 31387.26 | 30843.80 | 30584.86 | 31390.17 | `npm run benchmark -- -p benchmark1000-legacy -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-legacy-nodeexpat.xml -w 1 -r 5` | Replaced deep-clone output normalization with shared shallow normalization and switched compact (`beautify: false`) writes to backpressure-safe streaming output paths |
| 2026-03-07T07:25:24Z | 1c04a72 | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000 | `config/benchmark1000.json` | 1 | 5 | 30448.36 | 31513.69 | 30895.67 | 30870.08 | 31524.39 | `npm run benchmark -- -p benchmark1000 -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-single-nodeexpat.xml -w 1 -r 5` | Replaced deep-clone output normalization with shared shallow normalization and switched compact (`beautify: false`) writes to backpressure-safe streaming output paths |
| 2026-03-07T07:34:29Z | 1c04a72 | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000-legacy | `config/benchmark1000-legacy.json` | 1 | 5 | 29956.22 | 30709.62 | 30273.40 | 30232.54 | 30719.08 | `npm run benchmark -- -p benchmark1000-legacy -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-legacy-nodeexpat.xml -w 1 -r 5` | Skipped whitespace-only text chunk accumulation in `productXmlStream`, reducing parser allocation pressure on large XML |
| 2026-03-07T07:34:29Z | 1c04a72 | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000 | `config/benchmark1000.json` | 1 | 5 | 30366.05 | 31655.65 | 30864.48 | 30836.52 | 31658.61 | `npm run benchmark -- -p benchmark1000 -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-single-nodeexpat.xml -w 1 -r 5` | Skipped whitespace-only text chunk accumulation in `productXmlStream`, reducing parser allocation pressure on large XML |
| 2026-03-07T07:50:53Z | a0c6d0f | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000-legacy | `config/benchmark1000-legacy.json` | 1 | 5 | 30162.18 | 30498.85 | 30356.76 | 30467.42 | 30500.98 | `npm run benchmark -- -p benchmark1000-legacy -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-legacy-nodeexpat.xml -w 1 -r 5` | Fixed image variation attribute mapping to preserve `$attrs.value` and prevent `value="undefined"` output; added regression tests for streamed source shape |
| 2026-03-07T07:50:53Z | a0c6d0f | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000 | `config/benchmark1000.json` | 1 | 5 | 29844.14 | 30277.15 | 30033.81 | 30014.44 | 30282.87 | `npm run benchmark -- -p benchmark1000 -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-single-nodeexpat.xml -w 1 -r 5` | Fixed image variation attribute mapping to preserve `$attrs.value` and prevent `value="undefined"` output; added regression tests for streamed source shape |
| 2026-03-07T07:59:31Z | a0c6d0f | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000-legacy | `config/benchmark1000-legacy.json` | 1 | 5 | 29838.65 | 30091.45 | 30001.86 | 30081.55 | 30098.33 | `npm run benchmark -- -p benchmark1000-legacy -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-legacy-nodeexpat.xml -w 1 -r 5` | Added local `xsd/xml.xsd` and removed leading blank lines in schema files so direct xmllint schema validation compiles reliably |
| 2026-03-07T07:59:31Z | a0c6d0f | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000 | `config/benchmark1000.json` | 1 | 5 | 29745.08 | 31010.73 | 30168.05 | 30031.22 | 31021.07 | `npm run benchmark -- -p benchmark1000 -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-single-nodeexpat.xml -w 1 -r 5` | Added local `xsd/xml.xsd` and removed leading blank lines in schema files so direct xmllint schema validation compiles reliably |
| 2026-03-07T08:55:06Z | 33f6947 | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000-legacy | `config/benchmark1000-legacy.json` | 1 | 5 | 29957.52 | 30097.94 | 30036.66 | 30031.22 | 30098.33 | `npm run benchmark -- -p benchmark1000-legacy -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-legacy-nodeexpat.xml -w 1 -r 5` | Added reusable output-integrity validation script and npm command (`validate:output`) for source-vs-filtered regression checks |
| 2026-03-07T08:55:06Z | 33f6947 | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000 | `config/benchmark1000.json` | 1 | 5 | 30203.56 | 31378.75 | 30604.15 | 30484.20 | 31390.17 | `npm run benchmark -- -p benchmark1000 -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-single-nodeexpat.xml -w 1 -r 5` | Added reusable output-integrity validation script and npm command (`validate:output`) for source-vs-filtered regression checks |
| 2026-03-09T10:10:14Z | 0c1b4d4 | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000-legacy | `config/benchmark1000-legacy.json` | 1 | 5 | 30487.58 | 31801.85 | 30832.10 | 30551.31 | 31809.60 | `npm run benchmark -- -p benchmark1000-legacy -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-legacy-nodeexpat.xml -w 1 -r 5` | Added optional `pricebookSourceFiles` config mode to reuse and filter existing source pricebooks by selected product IDs, with random amount generation retained as fallback |
| 2026-03-09T10:10:14Z | 0c1b4d4 | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000 | `config/benchmark1000.json` | 1 | 5 | 30335.26 | 31848.32 | 30647.15 | 30366.76 | 31859.93 | `npm run benchmark -- -p benchmark1000 -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-single-nodeexpat.xml -w 1 -r 5` | Added optional `pricebookSourceFiles` config mode to reuse and filter existing source pricebooks by selected product IDs, with random amount generation retained as fallback |
| 2026-03-09T10:25:44Z | 0c1b4d4 | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000-legacy | `config/benchmark1000-legacy.json` | 1 | 5 | 29391.38 | 30059.17 | 29654.53 | 29511.12 | 30064.77 | `npm run benchmark -- -p benchmark1000-legacy -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-legacy-nodeexpat.xml -w 1 -r 5` | Added dedicated `config/puma.json` profile that selects 20 catalog products shared by the Puma catalog and both source pricebooks, then verifies filtered list and sale pricebook outputs |
| 2026-03-09T10:25:44Z | 0c1b4d4 | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000 | `config/benchmark1000.json` | 1 | 5 | 29921.81 | 30946.87 | 30412.07 | 30282.87 | 30953.96 | `npm run benchmark -- -p benchmark1000 -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-single-nodeexpat.xml -w 1 -r 5` | Added dedicated `config/puma.json` profile that selects 20 catalog products shared by the Puma catalog and both source pricebooks, then verifies filtered list and sale pricebook outputs |
| 2026-03-09T10:41:29Z | 0c1b4d4 | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000-legacy | `config/benchmark1000-legacy.json` | 1 | 5 | 30224.44 | 30628.89 | 30385.54 | 30316.43 | 30635.20 | `npm run benchmark -- -p benchmark1000-legacy -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-legacy-nodeexpat.xml -w 1 -r 5` | Changed source-pricebook mode to emit one filtered output file per source pricebook, using suffixed filenames and cleaning up stale combined `-pricebook` outputs |
| 2026-03-09T10:41:29Z | 0c1b4d4 | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000 | `config/benchmark1000.json` | 1 | 5 | 30258.62 | 32624.77 | 31021.79 | 30819.75 | 32631.69 | `npm run benchmark -- -p benchmark1000 -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-single-nodeexpat.xml -w 1 -r 5` | Changed source-pricebook mode to emit one filtered output file per source pricebook, using suffixed filenames and cleaning up stale combined `-pricebook` outputs |
| 2026-03-09T11:02:11Z | 0c1b4d4 | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000-legacy | `config/benchmark1000-legacy.json` | 1 | 5 | 29771.79 | 30329.02 | 29950.69 | 29846.67 | 30333.21 | `npm run benchmark -- -p benchmark1000-legacy -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-legacy-nodeexpat.xml -w 1 -r 5` | Reran the dedicated Puma profile with `beautify: true`; confirmed formatted catalog, inventory, and split pricebook outputs are generated successfully |
| 2026-03-09T11:02:11Z | 0c1b4d4 | master | mac16,7-apple-m4-pro-48gb | node-expat | v22.22.0 | 10.9.4 | benchmark1000 | `config/benchmark1000.json` | 1 | 5 | 30292.88 | 31031.13 | 30494.95 | 30349.98 | 31037.85 | `npm run benchmark -- -p benchmark1000 -i files/source/puma-catalog.xml -o files/filtered/puma-bench-full-single-nodeexpat.xml -w 1 -r 5` | Reran the dedicated Puma profile with `beautify: true`; confirmed formatted catalog, inventory, and split pricebook outputs are generated successfully |

## ASCII Trend (Mean ms, lower is better)

Scale: each `#` is about 10,000 ms of mean runtime.

### benchmark1000-legacy
- 2026-03-07T06:32:21Z | 30578.50 ms | ###
- 2026-03-07T07:25:24Z | 30843.80 ms | ###
- 2026-03-07T07:34:29Z | 30273.40 ms | ###
- 2026-03-07T07:50:53Z | 30356.76 ms | ###
- 2026-03-07T07:59:31Z | 30001.86 ms | ###
- 2026-03-07T08:55:06Z | 30036.66 ms | ###
- 2026-03-09T10:10:14Z | 30832.10 ms | ###
- 2026-03-09T10:25:44Z | 29654.53 ms | ###
- 2026-03-09T10:41:29Z | 30385.54 ms | ###
- 2026-03-09T11:02:11Z | 29950.69 ms | ###

### benchmark1000
- 2026-03-07T06:32:21Z | 30760.56 ms | ###
- 2026-03-07T07:25:24Z | 30895.67 ms | ###
- 2026-03-07T07:34:29Z | 30864.48 ms | ###
- 2026-03-07T07:50:53Z | 30033.81 ms | ###
- 2026-03-07T07:59:31Z | 30168.05 ms | ###
- 2026-03-07T08:55:06Z | 30604.15 ms | ###
- 2026-03-09T10:10:14Z | 30647.15 ms | ###
- 2026-03-09T10:25:44Z | 30412.07 ms | ###
- 2026-03-09T10:41:29Z | 31021.79 ms | ###
- 2026-03-09T11:02:11Z | 30494.95 ms | ###

## Update Template

Copy a row and update all fields after each benchmark-required repository modification:

| Timestamp (UTC) | Commit | Branch | Device ID | Variant | Node.js | npm | Profile | Config File | Warm-up | Measured | Min ms | Max ms | Mean ms | Median p50 ms | P95 ms | Command | Change Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| YYYY-MM-DDTHH:MM:SSZ | <short-sha> | <branch> | mac16,7-apple-m4-pro-48gb | node-expat | <node-version> | <npm-version> | benchmark1000-legacy or benchmark1000 | `config/<file>.json` | 1 | 5 | <min> | <max> | <mean> | <median> | <p95> | <full command> | <what changed> |
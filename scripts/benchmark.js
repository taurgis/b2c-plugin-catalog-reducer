#!/usr/bin/env node

const fsPromises = require('fs/promises');
const path = require('path');
const process = require('process');
const { createHistogram } = require('perf_hooks');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const { loadConfigFile } = require('../lib/selectorConfig');
const parser = require('../lib/parser');
const { createSilentRuntime } = require('../lib/runtimeSupport');
const { deriveOutputFilename, derivePricebookOutputFilenames } = require('../lib/xmlSchemaValidator');

const resolveCliPath = inputPath => path.resolve(process.cwd(), inputPath);

const deriveBenchmarkOutputFilename = (outputFilename, runIndex) => {
    const parsed = path.parse(outputFilename);
    const extension = parsed.ext || '.xml';

    return path.join(parsed.dir, `${parsed.name}-run-${runIndex}${extension}`);
};

const removeOutputTriplet = async (outputFilename, selectorConfig) => {
    const files = [
        outputFilename,
        deriveOutputFilename(outputFilename, '-inventory'),
        ...derivePricebookOutputFilenames(outputFilename, selectorConfig)
    ];

    await Promise.all(files.map(file => fsPromises.rm(file, { force: true })));
};

const parseArguments = () => {
    return yargs(hideBin(process.argv))
        .option('config', {
            alias: 'c',
            description: 'Path to the benchmark config JSON file',
            type: 'string',
            demandOption: true
        })
        .option('input', {
            alias: 'i',
            description: 'Input catalog XML file path',
            type: 'string',
            demandOption: true
        })
        .option('output', {
            alias: 'o',
            description: 'Output filename prefix for benchmark runs',
            type: 'string',
            demandOption: true
        })
        .option('runs', {
            alias: 'r',
            description: 'Number of measured runs',
            type: 'number',
            default: 5
        })
        .option('warmup', {
            alias: 'w',
            description: 'Number of warm-up runs before measurements',
            type: 'number',
            default: 1
        })
        .strict()
        .help()
        .parse();
};

async function main() {
    const argv = parseArguments();
    const selectorConfig = await loadConfigFile(argv.config);
    const inputFilename = resolveCliPath(argv.input);
    const outputFilename = resolveCliPath(argv.output);
    const measuredRuns = Math.max(1, Math.trunc(Number(argv.runs) || 1));
    const warmupRuns = Math.max(0, Math.trunc(Number(argv.warmup) || 0));
    const histogram = createHistogram();

    const runOnce = async runIndex => {
        const runOutputFilename = deriveBenchmarkOutputFilename(outputFilename, runIndex);
        const begin = process.hrtime.bigint();

        await parser.parse(inputFilename, runOutputFilename, selectorConfig, createSilentRuntime());

        const elapsedNanoseconds = process.hrtime.bigint() - begin;
        await removeOutputTriplet(runOutputFilename, selectorConfig);

        return elapsedNanoseconds;
    };

    console.log(`Benchmark config: file=${path.resolve(process.cwd(), argv.config)}, input=${inputFilename}`);
    console.log(`Warm-up runs: ${warmupRuns}, measured runs: ${measuredRuns}`);

    for (let i = 0; i < warmupRuns; i++) {
        const elapsedNanoseconds = await runOnce(`warmup-${i + 1}`);
        const elapsedMilliseconds = Number(elapsedNanoseconds) / 1e6;

        console.log(`Warm-up ${i + 1}: ${elapsedMilliseconds.toFixed(2)} ms`);
    }

    const measuredDurations = [];

    for (let i = 0; i < measuredRuns; i++) {
        const elapsedNanoseconds = await runOnce(i + 1);
        const elapsedMilliseconds = Number(elapsedNanoseconds) / 1e6;

        measuredDurations.push(elapsedMilliseconds);
        histogram.record(Number(elapsedNanoseconds));
        console.log(`Run ${i + 1}: ${elapsedMilliseconds.toFixed(2)} ms`);
    }

    const minMilliseconds = Math.min(...measuredDurations);
    const maxMilliseconds = Math.max(...measuredDurations);
    const meanMilliseconds = measuredDurations.reduce((sum, value) => sum + value, 0) / measuredDurations.length;
    const medianMilliseconds = Number(histogram.percentileBigInt(50)) / 1e6;
    const p95Milliseconds = Number(histogram.percentileBigInt(95)) / 1e6;

    console.log('\nBenchmark summary');
    console.log(`min: ${minMilliseconds.toFixed(2)} ms`);
    console.log(`max: ${maxMilliseconds.toFixed(2)} ms`);
    console.log(`mean: ${meanMilliseconds.toFixed(2)} ms`);
    console.log(`median (p50): ${medianMilliseconds.toFixed(2)} ms`);
    console.log(`p95: ${p95Milliseconds.toFixed(2)} ms`);
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

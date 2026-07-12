import {runCatalogReduce} from './reduce/runCatalogReduce';

export type ReducerRunOptions = {
  cache?: boolean;
  config?: string;
  dryRun?: boolean;
  input: string;
  invocationCwd?: string;
  output: string;
};

/**
 * Runs the catalog reduce workflow in-process (see src/lib/reduce/**).
 *
 * Previously this spawned `reducer.js` as a child process and resolved with
 * its exit code (0 on success, non-zero if the child's `main()` caught an
 * error and set `process.exitCode`). Now that the logic runs directly in
 * this process, there is no child exit code to relay: this resolves `0` on
 * success and rejects with the underlying error on failure. `reduce.ts`
 * already supports both outcomes (it checks `exitCode !== 0` and also
 * catches/rejects), so its `exitCode !== 0` branch is preserved but is now
 * unreachable dead code rather than something exercised in practice.
 */
export const runReducer = async (options: ReducerRunOptions): Promise<number> => {
  const invocationCwd = options.invocationCwd ?? process.cwd();

  await runCatalogReduce({
    cache: options.cache,
    config: options.config,
    dryRun: options.dryRun,
    input: options.input,
    invocationCwd,
    output: options.output
  });

  return 0;
};

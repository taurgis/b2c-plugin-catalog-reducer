import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';

export type ReducerRunOptions = {
  config?: string;
  input: string;
  invocationCwd?: string;
  output: string;
};

export type ReducerInvocation = {
  args: string[];
  command: string;
  cwd: string;
};

const repoRoot = path.resolve(__dirname, '..', '..');
const reducerEntry = path.join(repoRoot, 'reducer.js');

const resolveInputPath = (inputPath: string, invocationCwd: string): string => {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }

  return path.resolve(invocationCwd, inputPath);
};

const resolveOutputPath = (outputPath: string, invocationCwd: string): string => {
  if (path.isAbsolute(outputPath)) {
    return outputPath;
  }

  return path.resolve(invocationCwd, outputPath);
};

const resolveConfigPath = (configPath: string, invocationCwd: string): string => {
  if (path.isAbsolute(configPath)) {
    return configPath;
  }

  return path.resolve(invocationCwd, configPath);
};

export const buildReducerInvocation = (options: ReducerRunOptions): ReducerInvocation => {
  if (!existsSync(reducerEntry)) {
    throw new Error(`Reducer entrypoint not found at ${reducerEntry}`);
  }

  const invocationCwd = options.invocationCwd ?? process.cwd();

  const args = [
    reducerEntry,
    '-i',
    resolveInputPath(options.input, invocationCwd),
    '-o',
    resolveOutputPath(options.output, invocationCwd)
  ];

  if (options.config) {
    args.push('-c', resolveConfigPath(options.config, invocationCwd));
  }

  return {
    args,
    command: process.execPath,
    cwd: repoRoot
  };
};

export const runReducer = async (options: ReducerRunOptions): Promise<number> => {
  const invocation = buildReducerInvocation(options);

  return new Promise<number>((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('close', code => {
      if (code === null) {
        reject(new Error('Reducer process exited without an exit code.'));
        return;
      }

      resolve(code);
    });
  });
};
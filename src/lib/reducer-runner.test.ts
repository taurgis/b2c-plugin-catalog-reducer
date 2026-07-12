import {describe, expect, it} from 'vitest';
import path from 'node:path';

import {buildReducerInvocation} from './reducer-runner';

describe('buildReducerInvocation', () => {
  it('resolves relative paths from the caller working directory', () => {
    const invocationCwd = path.join(process.cwd(), 'fixtures');
    const invocation = buildReducerInvocation({
      config: 'configs/local.json',
      input: 'files/source/puma-catalog.xml',
      invocationCwd,
      output: 'files/filtered/puma-test.xml'
    });

    expect(invocation.cwd).toBe(process.cwd());
    expect(invocation.args).toContain(path.resolve(invocationCwd, 'configs/local.json'));
    expect(invocation.args).toContain(path.resolve(invocationCwd, 'files/source/puma-catalog.xml'));
    expect(invocation.args).toContain(path.resolve(invocationCwd, 'files/filtered/puma-test.xml'));
    expect(invocation.args).toContain('-c');
  });

  it('preserves absolute paths', () => {
    const invocation = buildReducerInvocation({
      input: '/tmp/input.xml',
      output: '/tmp/output.xml'
    });

    expect(invocation.args).toContain('/tmp/input.xml');
    expect(invocation.args).toContain('/tmp/output.xml');
  });

  it('adds --dry-run when dryRun is set', () => {
    const invocation = buildReducerInvocation({
      dryRun: true,
      input: '/tmp/input.xml',
      output: '/tmp/output.xml'
    });

    expect(invocation.args).toContain('--dry-run');
  });

  it('omits --dry-run by default', () => {
    const invocation = buildReducerInvocation({
      input: '/tmp/input.xml',
      output: '/tmp/output.xml'
    });

    expect(invocation.args).not.toContain('--dry-run');
  });

  it('adds --no-cache when cache is disabled', () => {
    const invocation = buildReducerInvocation({
      cache: false,
      input: '/tmp/input.xml',
      output: '/tmp/output.xml'
    });

    expect(invocation.args).toContain('--no-cache');
  });

  it('omits --no-cache when cache is left at its default', () => {
    const invocation = buildReducerInvocation({
      input: '/tmp/input.xml',
      output: '/tmp/output.xml'
    });

    expect(invocation.args).not.toContain('--no-cache');
  });
});
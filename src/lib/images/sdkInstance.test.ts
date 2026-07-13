import {beforeEach, describe, expect, it, vi} from 'vitest';

const resolveConfig = vi.fn();

vi.mock('@salesforce/b2c-tooling-sdk/config', () => ({
  resolveConfig
}));

describe('assertSupportedNodeVersion', () => {
  it('does not throw for a version above the minimum', async () => {
    const {assertSupportedNodeVersion} = await import('./sdkInstance');

    expect(() => assertSupportedNodeVersion('23.0.0')).not.toThrow();
  });

  it('does not throw for a version equal to the minimum', async () => {
    const {assertSupportedNodeVersion} = await import('./sdkInstance');

    expect(() => assertSupportedNodeVersion('22.16.0')).not.toThrow();
  });

  it('does not throw for a higher patch on the minimum minor', async () => {
    const {assertSupportedNodeVersion} = await import('./sdkInstance');

    expect(() => assertSupportedNodeVersion('22.16.3')).not.toThrow();
  });

  it('throws for a version below the minimum minor on the same major', async () => {
    const {assertSupportedNodeVersion} = await import('./sdkInstance');

    expect(() => assertSupportedNodeVersion('22.15.9')).toThrow(/Node\.js >=22\.16\.0/);
  });

  it('throws for an older major version', async () => {
    const {assertSupportedNodeVersion} = await import('./sdkInstance');

    expect(() => assertSupportedNodeVersion('20.11.0')).toThrow(/current: 20\.11\.0/);
  });
});

describe('createLiveWebdavInstance', () => {
  beforeEach(() => {
    resolveConfig.mockReset();
  });

  it('rejects with a Node-version error before ever calling resolveConfig', async () => {
    const {createLiveWebdavInstance} = await import('./sdkInstance');

    await expect(createLiveWebdavInstance('18.0.0')).rejects.toThrow(/Node\.js >=22\.16\.0/);
    expect(resolveConfig).not.toHaveBeenCalled();
  });

  it('rejects with a clear error when no instance configuration is found', async () => {
    resolveConfig.mockResolvedValue({
      hasB2CInstanceConfig: () => false
    });

    const {createLiveWebdavInstance} = await import('./sdkInstance');

    await expect(createLiveWebdavInstance()).rejects.toThrow(/No B2C instance configuration found/);
  });

  it('returns the created instance when configuration is available', async () => {
    const fakeInstance = {webdav: {get: vi.fn()}};

    resolveConfig.mockResolvedValue({
      createB2CInstance: () => fakeInstance,
      hasB2CInstanceConfig: () => true
    });

    const {createLiveWebdavInstance} = await import('./sdkInstance');

    await expect(createLiveWebdavInstance()).resolves.toBe(fakeInstance);
  });
});

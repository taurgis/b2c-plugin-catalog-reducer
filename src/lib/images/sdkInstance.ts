import {WebdavInstanceLike} from './webdavClient';

const MIN_NODE_MAJOR = 22;
const MIN_NODE_MINOR = 16;

const isSupportedNodeVersion = (versionString: string): boolean => {
  const [major, minor] = versionString.split('.').map(Number);

  return major > MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor >= MIN_NODE_MINOR);
};

export const assertSupportedNodeVersion = (versionString: string = process.versions.node): void => {
  if (isSupportedNodeVersion(versionString)) {
    return;
  }

  throw new Error(
    `catalog images download requires Node.js >=${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}.0 `
    + `(current: ${versionString}) because it depends on @salesforce/b2c-tooling-sdk, `
    + 'an ESM-only package that relies on Node\'s require(esm) support.'
  );
};

export const createLiveWebdavInstance = async (
  nodeVersion: string = process.versions.node
): Promise<WebdavInstanceLike> => {
  assertSupportedNodeVersion(nodeVersion);

  // @salesforce/b2c-tooling-sdk is ESM-only; this repo compiles to
  // CommonJS, so this must stay a dynamic import rather than a static one
  // (see src/lib/images/b2cToolingSdkConfig.d.ts for why the type shape is
  // declared separately rather than resolved from the package's own types).
  const {resolveConfig} = await import('@salesforce/b2c-tooling-sdk/config');
  const config = await resolveConfig();

  if (!config.hasB2CInstanceConfig()) {
    throw new Error(
      'No B2C instance configuration found (checked dw.json, environment variables, and '
      + '~/.mobify). Configure sandbox credentials before running catalog images download.'
    );
  }

  return config.createB2CInstance();
};

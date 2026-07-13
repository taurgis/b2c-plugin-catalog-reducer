// `@salesforce/b2c-tooling-sdk` ships its own real types, but only reachable
// via its `package.json` `exports` subpath map. This repo's classic
// `moduleResolution: "Node"` (kept unchanged repo-wide - see the catalog
// images download plan for why) cannot resolve subpath exports at all, so
// this ambient declaration gives TypeScript just enough shape for the one
// subpath this feature dynamically imports at runtime. Node's own module
// resolution (via `require(esm)`, Node >=22.16) resolves the real module
// fine regardless of what TypeScript believes here.
declare module '@salesforce/b2c-tooling-sdk/config' {
  import {WebdavInstanceLike} from './webdavClient';

  interface ResolvedB2CConfigLike {
    hasB2CInstanceConfig(): boolean;
    createB2CInstance(): WebdavInstanceLike;
  }

  export function resolveConfig(overrides?: Record<string, unknown>): Promise<ResolvedB2CConfigLike>;
}

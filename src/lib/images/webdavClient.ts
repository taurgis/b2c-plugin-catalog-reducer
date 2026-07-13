import fs from 'node:fs/promises';

import {sanitizeErrorMessage} from './redact';
import {WebdavImageClient} from './types';

export interface WebdavInstanceLike {
  webdav: {
    get(path: string): Promise<ArrayBuffer>;
  };
}

export const createSdkWebdavImageClient = (instance: WebdavInstanceLike): WebdavImageClient => ({
  download: async (remotePath: string, localPath: string): Promise<void> => {
    try {
      const content = await instance.webdav.get(remotePath);

      await fs.writeFile(localPath, Buffer.from(content));
    } catch (error) {
      // Deliberately not attaching `error` as `cause`: it may carry
      // unredacted credentials (auth headers, secrets) from the SDK, and a
      // `cause` chain is exactly what a logger/error formatter would print.
      // eslint-disable-next-line preserve-caught-error
      throw new Error(sanitizeErrorMessage(error));
    }
  }
});

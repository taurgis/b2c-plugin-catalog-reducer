// Minimal ambient type declarations for dependencies that ship no types of
// their own and have no `@types/*` package on npm (or where pulling one in
// would be a new dependency this port doesn't need). These are intentionally
// loose - just enough to satisfy `strict`/`noImplicitAny` without describing
// behavior beyond what this codebase actually calls.

declare module 'cli-progress' {
  interface ProgressBarOptions {
    format?: string;
    hideCursor?: boolean;
    [key: string]: unknown;
  }

  class SingleBar {
    constructor(options?: ProgressBarOptions, preset?: unknown);
    start(total: number, startValue: number, payload?: Record<string, unknown>): void;
    stop(): void;
    update(current: number, payload?: Record<string, unknown>): void;
    setTotal(total: number): void;
  }

  const Presets: {
    shades_classic: unknown;
    shades_grey: unknown;
    legacy: unknown;
    rect: unknown;
  };

  const cliProgress: {
    SingleBar: typeof SingleBar;
    Presets: typeof Presets;
  };

  export {SingleBar, Presets};
  export default cliProgress;
}

declare module 'xml-flow' {
  import {Readable} from 'node:stream';

  interface XmlFlowEmitter {
    on(event: string, listener: (...args: any[]) => void): XmlFlowEmitter;
    once(event: string, listener: (...args: any[]) => void): XmlFlowEmitter;
    removeAllListeners(event?: string): XmlFlowEmitter;
    pause(): void;
    resume(): void;
    isPaused(): boolean;
  }

  interface XmlFlowFactory {
    (stream: Readable, options?: Record<string, unknown>): XmlFlowEmitter;
    toXml(value: unknown, options?: Record<string, unknown>): string;
  }

  const flow: XmlFlowFactory;
  export default flow;
}

declare module 'node-expat' {
  import {EventEmitter} from 'node:events';

  class Parser extends EventEmitter {
    constructor(encoding?: string);
    parse(chunk: string | Buffer, isFinal: boolean): boolean;
  }

  export {Parser};
}

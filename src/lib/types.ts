// Shared, intentionally loose types for the catalog reducer's XML-derived JSON
// model. The XML->JSON shape (xml-flow / node-expat wrapper conventions) is
// dynamic by nature (`$attrs`, `$text`, arbitrary child keys, single-vs-array
// collapsing) so precise structural typing is out of scope for this
// behavior-preserving port; `any`/loose index types are used deliberately
// throughout src/lib to avoid introducing type-driven behavior changes.
// (`@typescript-eslint/no-explicit-any` is disabled for src/**/*.ts.)

export type XmlNode = Record<string, any>;

export type SelectorConfig = Record<string, any>;

export interface Logger {
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

export interface ProgressBar {
  start(total: number, value: number): void;
  stop(): void;
  update(value: number, payload?: Record<string, unknown>): void;
  setTotal(total: number): void;
}

export interface RuntimeOptions {
  dryRun?: boolean;
  useCache?: boolean;
  logger?: Logger;
  progress?: ProgressBar;
  enableProgress?: boolean;
}

export interface NormalizedRuntime {
  dryRun: boolean;
  useCache: boolean;
  logger: Logger;
  progress: ProgressBar;
}

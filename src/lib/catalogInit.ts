import fs from 'node:fs/promises';
import path from 'node:path';

// Auto-detection heuristic (explicit and testable, not "usually works"):
// scan a directory (non-recursive) for *.xml files and classify each by a
// filename substring, case-insensitive:
//   - contains "pricebook"  -> pricebook source candidate
//   - contains "storefront" -> storefront source candidate
//   - contains "inventory"  -> detected but not surfaced (inventory output
//                               is always generated, never sourced - see
//                               src/lib/reduce/writeInventory.ts)
//   - anything else         -> master catalog candidate
// Exactly one master catalog candidate auto-selects; zero or multiple are
// reported as ambiguous for the caller (command) to resolve (prompt, or
// fail clearly in non-interactive mode).
export interface DetectedCatalogFiles {
  catalogFile: string | null;
  pricebookFiles: string[];
  storefrontFiles: string[];
  ambiguousCatalogCandidates: string[];
}

const isXmlFile = (fileName: string): boolean => fileName.toLowerCase().endsWith('.xml');

export const detectCatalogStructure = async (directory: string): Promise<DetectedCatalogFiles> => {
  const entries = await fs.readdir(directory, {withFileTypes: true});
  const xmlFileNames = entries
    .filter(entry => entry.isFile() && isXmlFile(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const pricebookFileNames: string[] = [];
  const storefrontFileNames: string[] = [];
  const catalogCandidateNames: string[] = [];

  for (const fileName of xmlFileNames) {
    const lowerFileName = fileName.toLowerCase();

    if (lowerFileName.includes('pricebook')) {
      pricebookFileNames.push(fileName);
    } else if (lowerFileName.includes('storefront')) {
      storefrontFileNames.push(fileName);
    } else if (lowerFileName.includes('inventory')) {
      continue;
    } else {
      catalogCandidateNames.push(fileName);
    }
  }

  const toAbsolutePaths = (fileNames: string[]): string[] => fileNames.map(fileName => path.join(directory, fileName));

  return {
    catalogFile: catalogCandidateNames.length === 1 ? path.join(directory, catalogCandidateNames[0]) : null,
    pricebookFiles: toAbsolutePaths(pricebookFileNames),
    storefrontFiles: toAbsolutePaths(storefrontFileNames),
    ambiguousCatalogCandidates: catalogCandidateNames.length === 1 ? [] : toAbsolutePaths(catalogCandidateNames)
  };
};

export interface ScaffoldConfigOptions {
  total: number;
  master: number;
  onlineSiteIds: string[];
  pricebookSourceFiles: string[];
  storefrontSourceFiles: string[];
}

/**
 * Builds the canonical flat config shape (see DEFAULT_SELECTOR_CONFIG in
 * selectorConfig.ts) - not the friendly nested shape - since this is what
 * every existing config/*.json fixture and this repo's documented
 * governance commands already expect.
 */
export const buildScaffoldedConfig = (options: ScaffoldConfigOptions): Record<string, unknown> => ({
  total: options.total,
  master: options.master,
  productIds: [],
  attributes: {custom: []},
  onlineSiteIds: options.onlineSiteIds,
  pricebookRandomSeed: null,
  pricebookSourceFiles: options.pricebookSourceFiles,
  storefrontSourceFiles: options.storefrontSourceFiles
});

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Writes the scaffolded config to an explicit file path - the caller then
 * passes that same path via `catalog reduce -c <path>`. Never registers an
 * implicit named profile (see AGENTS.md: "Use explicit config file paths
 * for CLI usage. Do not reintroduce -p profile mode.").
 */
export const writeScaffoldedConfig = async (outputPath: string, config: Record<string, unknown>, force: boolean): Promise<void> => {
  if (!force && await fileExists(outputPath)) {
    throw new Error(`Config file already exists at ${outputPath}. Re-run with --force to overwrite.`);
  }

  await fs.writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
};

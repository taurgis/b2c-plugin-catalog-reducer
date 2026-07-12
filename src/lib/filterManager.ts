import chalk from 'chalk';

import Filter, {FilterRuntimeState, FilterStatistics} from './filters/filter';
import {normalizeSelectedProducts} from './normalizeSelectedProducts';
import {normalizeRuntimeOptions} from './runtimeSupport';
import {canCaptureFillerDuringPreferredPass} from './selectionConfig';
import {Logger, ProgressBar, RuntimeOptions, SelectorConfig, XmlNode} from './types';

type FilterConstructor = (new (
  inputFile: string,
  selectorConfig: SelectorConfig,
  statistics: FilterStatistics,
  progress: ProgressBar,
  runtimeState: FilterRuntimeState,
  logger?: Logger
) => Filter) & {usesStandaloneFillerCapture?: boolean};

/**
 * The filter manager, managing all filters to process the XML file and
 * make product selections.
 */
export default class FilterManager {
  statistics: FilterStatistics = {
    total: 0,
    master: 0,
    variants: 0,
    variationGroups: 0,
    attributes: {
      custom: {}
    },
    productIds: new Set()
  };

  filters: Filter[];
  selection: XmlNode[];
  inputFile: string;
  selectorConfig: SelectorConfig;
  runtimeState: FilterRuntimeState;
  logger: Logger;
  progress: ProgressBar;

  constructor(inputFile: string, selectorConfig: SelectorConfig, runtimeOptions?: RuntimeOptions) {
    const runtime = normalizeRuntimeOptions(runtimeOptions);

    this.filters = [];
    this.selection = [];
    this.inputFile = inputFile;
    this.selectorConfig = selectorConfig;
    this.runtimeState = {
      totalTarget: Number(selectorConfig.total) || 0,
      preferredProductIds: new Set(Array.isArray(selectorConfig.productIds) ? selectorConfig.productIds : []),
      enableCapturedFiller: canCaptureFillerDuringPreferredPass(selectorConfig),
      fillerCandidates: [],
      fillerExcludedProductIds: new Set(),
      hasStandaloneFillerFilter: false
    };
    this.logger = runtime.logger;
    this.progress = runtime.progress;
  }

  #appendCapturedFillerSelection = (): void => {
    if (
      !this.runtimeState.enableCapturedFiller
      || this.runtimeState.hasStandaloneFillerFilter
      || !this.runtimeState.fillerCandidates!.length
    ) {
      return;
    }

    for (let i = 0; i < this.runtimeState.fillerCandidates!.length; i++) {
      if (!this.runtimeState.totalTarget || this.statistics.total >= this.runtimeState.totalTarget) {
        break;
      }

      const product = this.runtimeState.fillerCandidates![i];
      const productId = product && product.$attrs ? product.$attrs['product-id'] : null;

      if (!productId || this.statistics.productIds.has(productId)) {
        continue;
      }

      this.selection.push(product);
      this.statistics.productIds.add(productId);
      this.statistics.total += 1;
      this.progress.update(this.statistics.total, {
        productId,
        filter: 'CapturedFiller'
      });
    }
  };

  /**
   * Register a filter in the manager to be executed.
   */
  registerFilter(FilterClass: FilterConstructor): void {
    if (FilterClass.usesStandaloneFillerCapture === true) {
      this.runtimeState.hasStandaloneFillerFilter = true;
    }

    this.filters.push(new FilterClass(
      this.inputFile,
      this.selectorConfig,
      this.statistics,
      this.progress,
      this.runtimeState,
      this.logger
    ));
  }

  /**
   * Execute all registered filters on the given inputfile
   */
  async executeFilters(): Promise<void> {
    this.progress.start(this.runtimeState.totalTarget, 0);

    const begin = Date.now();

    for (let i = 0; i < this.filters.length; i++) {
      const filter = this.filters[i];

      if (typeof filter.shouldSkip === 'function' && filter.shouldSkip()) {
        continue;
      }

      const results = await filter.execute();
      this.selection.push(...results);
    }

    this.#appendCapturedFillerSelection();

    this.progress.stop();

    const timeSpent = (Date.now() - begin) / 1000 + ' seconds';
    this.logger.info(chalk.blue('\nProcessing Time') + ': ' + timeSpent);
    this.logger.info(chalk.yellow('\n------------------------------\n'));
  }

  /**
   * Fixes the JSON structure to something more similar to the original XML file.
   */
  #fixJSONProducts = (): void => {
    this.selection = normalizeSelectedProducts(this.selection);
  };

  /**
   * Get the selected products.
   */
  getSelection(): XmlNode[] {
    this.#fixJSONProducts();

    this.logger.info(chalk.blue('Processing finished') + ': \n' +
      chalk.green('\tTotal') + ': ' + chalk.yellow(this.statistics.total) + '\n' +
      chalk.green('\tMaster') + ': ' + chalk.yellow(this.statistics.master) + '\n' +
      chalk.green('\tVariation Groups') + ': ' + chalk.yellow(this.statistics.variationGroups) + '\n' +
      chalk.green('\tvariants') + ': ' + chalk.yellow(this.statistics.variants) + '\n'
    );

    this.logger.info(chalk.blue('Preferred Products that did not make the selection') + ': \n' +
      chalk.red(this.runtimeState.preferredProductIds.size
        ? ('\t- ' + [...this.runtimeState.preferredProductIds].join('\n\t- '))
        : '\t(none)')
    );

    return this.selection;
  }
}

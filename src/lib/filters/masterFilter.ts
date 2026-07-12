import * as selectors from '../selectors';
import {ProgressBar, SelectorConfig, XmlNode} from '../types';
import Filter, {FilterResult, FilterRuntimeState, FilterStatistics} from './filter';

/**
 * Filter to get the masters from the given XML file.
 */
export default class MasterFilter extends Filter {
  constructor(
    inputFile: string,
    selectorConfig: SelectorConfig,
    statistics: FilterStatistics,
    progress: ProgressBar,
    runtimeState: FilterRuntimeState
  ) {
    super(inputFile, selectorConfig, statistics, progress, runtimeState);

    this.statistics.master = 0;
    this.statistics.variants = 0;
    this.statistics.variationGroups = 0;
  }

  updateStatistics = (productId: string | null | undefined): void => {
    if (!productId) return;

    this.statistics.productIds.add(productId);
    this.statistics.total += 1;
    this.statistics.master += 1;
  };

  shouldSkip(): boolean {
    return !(this.selectorConfig.master && (this.statistics.master < this.selectorConfig.master));
  }

  process(product: XmlNode): FilterResult {
    if (this.selectorConfig.master && (this.statistics.master < this.selectorConfig.master)) {
      const isMaster = selectors.isMaster(product);

      if (isMaster) {
        this.processMasterProduct(product);

        return Filter.NOT_FINISHED_WITH_PRODUCT(product);
      }

      return Filter.NOT_FINISHED;
    }

    return Filter.FINISHED;
  }
}

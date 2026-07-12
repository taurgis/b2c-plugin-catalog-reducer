import * as selectors from '../selectors';
import {ProgressBar, SelectorConfig, XmlNode} from '../types';
import Filter, {FilterResult, FilterRuntimeState, FilterStatistics} from './filter';

/**
 * Filter products from the XML based on custom attributes.
 */
export default class AttributeFilter extends Filter {
  constructor(
    inputFile: string,
    selectorConfig: SelectorConfig,
    statistics: FilterStatistics,
    progress: ProgressBar,
    runtimeState: FilterRuntimeState
  ) {
    super(inputFile, selectorConfig, statistics, progress, runtimeState);
  }

  shouldSkip(): boolean {
    return !this.hasCapacity()
      || !this.selectorConfig.attributes
      || !Array.isArray(this.selectorConfig.attributes.custom)
      || !this.selectorConfig.attributes.custom.length;
  }

  process(product: XmlNode): FilterResult {
    if (this.hasCapacity()) {
      const isMaster = selectors.isMaster(product);

      if (!isMaster) {
        if (this.selectorConfig.attributes && this.selectorConfig.attributes.custom && this.selectorConfig.attributes.custom.length) {
          let allAttributesDone = true;
          let selected = false;

          this.selectorConfig.attributes.custom.forEach((attributeConfig: any) => {
            if (selected) {
              return;
            }

            const aid = attributeConfig.id;
            this.statistics.attributes.custom[aid] = this.statistics.attributes.custom[aid] || 0;

            if (this.statistics.attributes.custom[aid] < attributeConfig.count) {
              allAttributesDone = false;

              if (selectors.hasCustomAttribute(product, aid, attributeConfig.value)) {
                this.statistics.attributes.custom[aid]++;
                selected = true;
              }
            }
          });

          return {
            selection: selected ? product : null,
            finished: allAttributesDone
          };
        }
      }
    }

    return Filter.FINISHED;
  }
}

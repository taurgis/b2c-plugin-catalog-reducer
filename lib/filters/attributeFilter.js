const Filter = require('./filter');
const selectors = require('../selectors');

/**
 * Filter products from the XML based on custom attributes.
 */
class AttributeFilter extends Filter {
    constructor(inputFile, selectorConfig, statistics, progress, runtimeState) {
        super(inputFile, selectorConfig, statistics, progress, runtimeState);
    }

    shouldSkip() {
        return !this.hasCapacity()
            || !this.selectorConfig.attributes
            || !Array.isArray(this.selectorConfig.attributes.custom)
            || !this.selectorConfig.attributes.custom.length;
    }

    process(product) {
        if (this.hasCapacity()) {
            const isMaster = selectors.isMaster(product);

            if (!isMaster) {
                if( this.selectorConfig.attributes && this.selectorConfig.attributes.custom && this.selectorConfig.attributes.custom.length) {
                    let allAttributesDone = true;
                    let selected = false;

                    this.selectorConfig.attributes.custom.forEach(attributeConfig => {
                        if(selected) {
                            return;
                        }

                        let aid = attributeConfig.id;
                        this.statistics.attributes.custom[aid] = this.statistics.attributes.custom[aid] || 0;

                        if (this.statistics.attributes.custom[aid] < attributeConfig.count) {
                            allAttributesDone = false;

                            if(selectors.hasCustomAttribute(product, aid, attributeConfig.value)) {
                                this.statistics.attributes.custom[aid]++;
                                selected = true;
                            }
                        }
                    });

                    return {
                        selection: selected ? product : null,
                        finished: allAttributesDone
                    }
                }
            }
        }

        return Filter.FINISHED;
    }
}

module.exports = AttributeFilter;

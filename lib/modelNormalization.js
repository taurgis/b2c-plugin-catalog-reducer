const toArray = value => {
    if (value === undefined || value === null) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
};

const toProductId = value => {
    if (typeof value === 'string') {
        return value;
    }

    if (value && value.$attrs && value.$attrs['product-id']) {
        return value.$attrs['product-id'];
    }

    if (value && value['product-id']) {
        return value['product-id'];
    }

    return null;
};

const extractProductIds = (value, nestedKey) => {
    const entries = toArray(value);

    if (entries.length === 1 && entries[0] && entries[0][nestedKey] !== undefined) {
        return toArray(entries[0][nestedKey]).map(toProductId).filter(Boolean);
    }

    return entries.map(toProductId).filter(Boolean);
};

module.exports = {
    toArray,
    toProductId,
    extractProductIds
};

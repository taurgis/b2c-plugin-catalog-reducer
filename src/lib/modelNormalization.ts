export const toArray = (value: unknown): any[] => {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
};

export const toProductId = (value: any): string | null => {
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

export const extractProductIds = (value: unknown, nestedKey: string): string[] => {
  const entries = toArray(value);

  if (entries.length === 1 && entries[0] && entries[0][nestedKey] !== undefined) {
    return toArray(entries[0][nestedKey]).map(toProductId).filter(Boolean) as string[];
  }

  return entries.map(toProductId).filter(Boolean) as string[];
};

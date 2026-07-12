// Narrow adapter around the native `node-expat` addon.
//
// This wraps a native binding that is now loaded in-process (previously it
// only ever ran inside a short-lived spawned `reducer.js` child, so a crash
// there only killed the child). Per the B2C DX Developer Tools Expert
// research for this port:
//   - The `'error'` listener on the returned EventEmitter is attached
//     synchronously within this function, before control returns to the
//     caller, so a JS-level parse error can never be an unhandled 'error'
//     event (which Node would otherwise rethrow and crash the process).
//   - This only covers JS-level parse errors surfaced via 'error'. A genuine
//     native-side crash in the addon itself is not catchable from JS and can
//     still bring down the host process - that is an accepted, documented
//     regression of moving this in-process (see M1 report), not something an
//     adapter boundary can fix.
import './vendor-shims';
import {EventEmitter} from 'node:events';
import fs from 'node:fs';

import {Parser} from 'node-expat';

import {XmlNode} from './types';

const INPUT_STREAM_HIGH_WATER_MARK = 256 * 1024;
const NON_FLATTENED_SINGLE_CHILD_CONTAINERS = new Set(['page-attributes']);

interface ProductStreamNode {
  name: string;
  attrs: Record<string, string> | null;
  children: Record<string, any> | null;
  childCount: number;
  firstChildName: string | null;
  textParts: string[] | null;
}

export interface ProductXmlStream {
  stream: fs.ReadStream;
  xml: EventEmitter & {
    pause: () => void;
    resume: () => void;
  };
}

const toLocalName = (name: unknown): any => {
  if (typeof name !== 'string') {
    return name;
  }

  const separatorIndex = name.indexOf(':');

  if (separatorIndex === -1) {
    return name;
  }

  return name.slice(separatorIndex + 1);
};

const hasOwnKeys = (value: unknown): boolean => {
  if (!value) {
    return false;
  }

  for (const key in value as Record<string, unknown>) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      return true;
    }
  }

  return false;
};

const createNode = (name: string, attrs: Record<string, string>): ProductStreamNode => {
  return {
    name,
    attrs: hasOwnKeys(attrs) ? attrs : null,
    children: null,
    childCount: 0,
    firstChildName: null,
    textParts: null
  };
};

const appendChild = (parentNode: ProductStreamNode, childName: string, childValue: unknown): void => {
  if (!parentNode.children) {
    parentNode.children = Object.create(null);
  }

  const currentValue = parentNode.children![childName];

  if (currentValue === undefined) {
    parentNode.children![childName] = childValue;
    parentNode.childCount += 1;

    if (parentNode.childCount === 1) {
      parentNode.firstChildName = childName;
    }

    return;
  }

  if (Array.isArray(currentValue)) {
    currentValue.push(childValue);
    return;
  }

  parentNode.children![childName] = [currentValue, childValue];
};

const buildNodeValue = (node: ProductStreamNode): any => {
  const hasChildren = node.childCount > 0;
  const hasTextParts = Array.isArray(node.textParts) && node.textParts.length > 0;
  const text = hasTextParts
    ? (node.textParts!.length === 1 ? node.textParts![0] : node.textParts!.join(''))
    : '';
  const trimmedText = hasTextParts ? text.trim() : '';
  const hasText = trimmedText.length > 0;

  if (!hasChildren) {
    if (node.attrs) {
      const value: XmlNode = {
        $attrs: node.attrs
      };

      if (hasText) {
        value.$text = trimmedText;
      }

      return value;
    }

    return hasText ? trimmedText : '';
  }

  const value: XmlNode = node.attrs
    ? {
      $attrs: node.attrs
    }
    : {};

  if (node.children) {
    for (const childKey in node.children) {
      if (Object.prototype.hasOwnProperty.call(node.children, childKey)) {
        value[childKey] = node.children[childKey];
      }
    }
  }

  if (hasText) {
    value.$text = trimmedText;
  }

  // Mirror xml-flow wrapper flattening for container tags such as
  // custom-attributes, images, variants, and variation-groups.
  if (
    !node.attrs
    && !hasText
    && node.childCount === 1
    && node.firstChildName
    && !NON_FLATTENED_SINGLE_CHILD_CONTAINERS.has(node.name)
  ) {
    return value[node.firstChildName];
  }

  return value;
};

export const openProductStream = (inputFile: string): ProductXmlStream => {
  const stream = fs.createReadStream(inputFile, {
    highWaterMark: INPUT_STREAM_HIGH_WATER_MARK
  });
  const parser = new Parser('UTF-8');
  const xml = new EventEmitter() as ProductXmlStream['xml'];

  let isSettled = false;
  const nodeStack: ProductStreamNode[] = [];
  let elementDepth = 0;
  let catalogDepth = 0;
  let productDepth = 0;

  const emitError = (error: unknown): void => {
    if (isSettled) {
      return;
    }

    isSettled = true;
    xml.emit('error', error);
  };

  // Attach the 'error' listener before this function returns control to the
  // caller (see module doc comment) - callers only ever interact with `xml`
  // via events, never the raw native parser.
  parser.on('startElement', (rawName: string, attrs: Record<string, string>) => {
    const name = toLocalName(rawName);
    elementDepth += 1;

    if (catalogDepth === 0 && name === 'catalog' && elementDepth === 1) {
      catalogDepth = elementDepth;
    }

    const startsProductCapture = productDepth === 0
      && catalogDepth > 0
      && elementDepth === catalogDepth + 1
      && name === 'product';

    if (startsProductCapture) {
      productDepth = 1;
      nodeStack.push(createNode(name, attrs));
      return;
    }

    if (productDepth > 0) {
      productDepth += 1;
      nodeStack.push(createNode(name, attrs));
    }
  });

  parser.on('text', (text: string) => {
    if (productDepth === 0 || !nodeStack.length) {
      return;
    }

    // Ignore insignificant whitespace-only text nodes to reduce parser allocation pressure.
    if (typeof text !== 'string' || text.trim().length === 0) {
      return;
    }

    const currentNode = nodeStack[nodeStack.length - 1];

    if (!currentNode.textParts) {
      currentNode.textParts = [text];
      return;
    }

    currentNode.textParts.push(text);
  });

  parser.on('endElement', (rawName: string) => {
    const name = toLocalName(rawName);

    if (productDepth > 0 && nodeStack.length) {
      const node = nodeStack.pop()!;
      const nodeValue = buildNodeValue(node);

      productDepth -= 1;

      if (productDepth === 0) {
        xml.emit('tag:product', nodeValue);
      } else {
        const parentNode = nodeStack[nodeStack.length - 1];
        appendChild(parentNode, name, nodeValue);
      }
    }

    if (catalogDepth > 0 && elementDepth === catalogDepth && name === 'catalog') {
      catalogDepth = 0;
    }

    elementDepth -= 1;
  });

  parser.on('error', emitError);

  stream.on('data', chunk => {
    if (isSettled) {
      return;
    }

    try {
      const isValidChunk = parser.parse(chunk as Buffer, false);

      if (!isValidChunk) {
        emitError(new Error('Unable to parse XML chunk.'));
      }
    } catch (error) {
      emitError(error);
    }
  });

  stream.on('error', emitError);

  stream.on('end', () => {
    if (isSettled) {
      return;
    }

    try {
      const isValidFinalChunk = parser.parse('', true);

      if (!isValidFinalChunk) {
        emitError(new Error('Unable to finalize XML parsing.'));
        return;
      }
    } catch (error) {
      emitError(error);
      return;
    }

    isSettled = true;
    xml.emit('end');
  });

  xml.pause = () => {
    if (!stream.destroyed) {
      stream.pause();
    }
  };

  xml.resume = () => {
    if (!stream.destroyed) {
      stream.resume();
    }
  };

  return {
    stream,
    xml
  };
};

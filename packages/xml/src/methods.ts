import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { XmlParseError } from './errors';

const METHOD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const METHOD_NAME = /^[a-z][A-Za-z0-9]*$/;
const METHOD_PARAM_NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export const METHOD_PARAM_TYPES = ['string', 'number', 'boolean', 'object', 'array', 'any'] as const;

export type MethodParamType = (typeof METHOD_PARAM_TYPES)[number];

export type PageMethodParam = {
  name: string;
  type: MethodParamType;
};

/** 方法元数据。代码不在这里，按 id 去 function 集合里取。 */
export type PageMethod = {
  id: string;
  name: string;
  desc?: string;
  params: PageMethodParam[];
  returns: PageMethodParam[];
  /** 暴露后，组件外部可以调用这个方法。 */
  expose?: boolean;
};

export function isPageMethodId(value: string): boolean {
  return METHOD_ID.test(value);
}

export function isPageMethodName(value: string): boolean {
  return METHOD_NAME.test(value);
}

export function isPageMethodParamName(value: string): boolean {
  return METHOD_PARAM_NAME.test(value);
}

export function isPageMethodParamType(value: string): value is MethodParamType {
  return (METHOD_PARAM_TYPES as readonly string[]).includes(value);
}

const codeParser = new XMLParser({
  ignoreAttributes: true,
  trimValues: false,
  preserveOrder: true,
});

const codeBuilder = new XMLBuilder({
  ignoreAttributes: false,
  format: false,
  preserveOrder: true,
  suppressEmptyNode: false,
});

export function serializeMethodCode(code: string): string {
  return codeBuilder.build([
    {
      '?xml': [],
      ':@': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    },
    {
      'method-code': [{ '#text': code }],
    },
  ]);
}

export function parseMethodCode(xml: string): string {
  const result = XMLValidator.validate(xml);
  if (result !== true) {
    throw new XmlParseError(result.err.msg);
  }
  const parsed: unknown = codeParser.parse(xml);
  if (!Array.isArray(parsed)) {
    throw new XmlParseError('XML does not contain method code');
  }
  for (const item of parsed) {
    if (!item || typeof item !== 'object' || !Object.prototype.hasOwnProperty.call(item, 'method-code')) {
      continue;
    }
    return elementText((item as { 'method-code'?: unknown })['method-code']);
  }
  throw new XmlParseError('XML does not contain method code');
}

function elementText(value: unknown): string {
  if (value == null || value === '') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (!Array.isArray(value)) {
    return '';
  }
  return value
    .map((item) => {
      if (item == null) {
        return '';
      }
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
        return String(item);
      }
      if (typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, '#text')) {
        return String((item as { '#text'?: unknown })['#text'] ?? '');
      }
      return '';
    })
    .join('');
}

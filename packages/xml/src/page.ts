import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { XmlParseError } from './errors';

export type WidgetStyle = {
  color?: string;
  textShadow?: string;
  italic?: boolean;
  fontWeight?: string;
  underline?: boolean;
  lineThrough?: boolean;
  background?: string;
  borderWidth?: number;
  borderStyle?: string;
  borderColor?: string;
  radiusTopLeft?: number;
  radiusTopRight?: number;
  radiusBottomRight?: number;
  radiusBottomLeft?: number;
  boxShadow?: string;
};

export type PageWidget =
  | { type: 'text'; id: string; value: string; style?: WidgetStyle }
  | { type: 'button'; id: string; text: string; style?: WidgetStyle };

export type PageXmlDocument = {
  widgets: PageWidget[];
};

type OrderedNode = Record<string, unknown> & {
  ':@'?: Record<string, unknown>;
};

const pageParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  preserveOrder: true,
});

const pageBuilder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  indentBy: '  ',
  suppressEmptyNode: true,
  preserveOrder: true,
});

const STYLE_KEYS = [
  'color',
  'textShadow',
  'italic',
  'fontWeight',
  'underline',
  'lineThrough',
  'background',
  'borderWidth',
  'borderStyle',
  'borderColor',
  'radiusTopLeft',
  'radiusTopRight',
  'radiusBottomRight',
  'radiusBottomLeft',
  'boxShadow',
] as const satisfies ReadonlyArray<keyof WidgetStyle>;

function attr(node: OrderedNode, name: string): string {
  const raw = node[':@']?.[`@_${name}`];
  return raw == null ? '' : String(raw);
}

function isTrue(value: string) {
  return value === 'true' || value === '1';
}

function parseBorderWidth(value: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseRadius(node: OrderedNode, name: string, fallback?: number) {
  return parseBorderWidth(attr(node, name)) ?? fallback;
}

export function compactWidgetStyle(style: WidgetStyle | undefined): WidgetStyle | undefined {
  if (!style) {
    return undefined;
  }

  const next: WidgetStyle = {};
  for (const key of STYLE_KEYS) {
    const value = style[key];
    if (value == null || value === '' || value === false) {
      continue;
    }
    if (
      (key === 'borderWidth' ||
        key === 'radiusTopLeft' ||
        key === 'radiusTopRight' ||
        key === 'radiusBottomRight' ||
        key === 'radiusBottomLeft') &&
      typeof value === 'number' &&
      value <= 0
    ) {
      continue;
    }
    (next as Record<string, unknown>)[key] = value;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function parseStyle(node: OrderedNode): WidgetStyle | undefined {
  const radius = parseBorderWidth(attr(node, 'border-radius'));
  return compactWidgetStyle({
    color: attr(node, 'color') || undefined,
    textShadow: attr(node, 'text-shadow') || undefined,
    italic: isTrue(attr(node, 'italic')) || undefined,
    fontWeight: attr(node, 'font-weight') || undefined,
    underline: isTrue(attr(node, 'underline')) || undefined,
    lineThrough: isTrue(attr(node, 'line-through')) || undefined,
    background: attr(node, 'background') || undefined,
    borderWidth: parseBorderWidth(attr(node, 'border-width')),
    borderStyle: attr(node, 'border-style') || undefined,
    borderColor: attr(node, 'border-color') || undefined,
    radiusTopLeft: parseRadius(node, 'border-top-left-radius', radius),
    radiusTopRight: parseRadius(node, 'border-top-right-radius', radius),
    radiusBottomRight: parseRadius(node, 'border-bottom-right-radius', radius),
    radiusBottomLeft: parseRadius(node, 'border-bottom-left-radius', radius),
    boxShadow: attr(node, 'box-shadow') || undefined,
  });
}

function styleAttrs(style: WidgetStyle | undefined): Record<string, string> {
  const compact = compactWidgetStyle(style);
  if (!compact) {
    return {};
  }

  const attrs: Record<string, string> = {};
  if (compact.color) {
    attrs['@_color'] = compact.color;
  }
  if (compact.fontWeight) {
    attrs['@_font-weight'] = compact.fontWeight;
  }
  if (compact.italic) {
    attrs['@_italic'] = 'true';
  }
  if (compact.underline) {
    attrs['@_underline'] = 'true';
  }
  if (compact.lineThrough) {
    attrs['@_line-through'] = 'true';
  }
  if (compact.textShadow) {
    attrs['@_text-shadow'] = compact.textShadow;
  }
  if (compact.background) {
    attrs['@_background'] = compact.background;
  }
  if (compact.borderWidth != null) {
    attrs['@_border-width'] = String(compact.borderWidth);
  }
  if (compact.borderStyle) {
    attrs['@_border-style'] = compact.borderStyle;
  }
  if (compact.borderColor) {
    attrs['@_border-color'] = compact.borderColor;
  }
  if (compact.radiusTopLeft != null) {
    attrs['@_border-top-left-radius'] = String(compact.radiusTopLeft);
  }
  if (compact.radiusTopRight != null) {
    attrs['@_border-top-right-radius'] = String(compact.radiusTopRight);
  }
  if (compact.radiusBottomRight != null) {
    attrs['@_border-bottom-right-radius'] = String(compact.radiusBottomRight);
  }
  if (compact.radiusBottomLeft != null) {
    attrs['@_border-bottom-left-radius'] = String(compact.radiusBottomLeft);
  }
  if (compact.boxShadow) {
    attrs['@_box-shadow'] = compact.boxShadow;
  }
  return attrs;
}

function findPageChildren(parsed: unknown): OrderedNode[] {
  if (!Array.isArray(parsed)) {
    throw new XmlParseError('XML does not contain a page root');
  }

  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const node = item as OrderedNode;
    if (Object.prototype.hasOwnProperty.call(node, 'page')) {
      const children = node.page;
      if (children == null || children === '') {
        return [];
      }
      return Array.isArray(children) ? (children as OrderedNode[]) : [];
    }
  }

  throw new XmlParseError('XML does not contain a page root');
}

export function parsePageXml(xml: string): PageXmlDocument {
  const result = XMLValidator.validate(xml);
  if (result !== true) {
    throw new XmlParseError(result.err.msg);
  }

  const parsed = pageParser.parse(xml);
  const children = findPageChildren(parsed);
  const widgets: PageWidget[] = [];
  let generated = 0;

  for (const child of children) {
    if (!child || typeof child !== 'object') {
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(child, 'text')) {
      generated += 1;
      widgets.push({
        type: 'text',
        id: attr(child, 'id') || `n${generated}`,
        value: attr(child, 'value'),
        style: parseStyle(child),
      });
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(child, 'button')) {
      generated += 1;
      widgets.push({
        type: 'button',
        id: attr(child, 'id') || `n${generated}`,
        text: attr(child, 'text'),
        style: parseStyle(child),
      });
    }
  }

  return { widgets };
}

export function serializePageXml(page: PageXmlDocument): string {
  const widgets = page.widgets.map((widget, index) => {
    const id = widget.id || `n${index + 1}`;
    const style = styleAttrs(widget.style);
    if (widget.type === 'text') {
      return {
        text: [],
        ':@': { '@_id': id, '@_value': widget.value, ...style },
      };
    }
    return {
      button: [],
      ':@': { '@_id': id, '@_text': widget.text, ...style },
    };
  });

  return pageBuilder.build([
    {
      '?xml': [],
      ':@': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    },
    { page: widgets },
  ]);
}

export const EMPTY_PAGE_XML = serializePageXml({ widgets: [] });

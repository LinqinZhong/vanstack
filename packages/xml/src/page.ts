import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { XmlParseError } from './errors';

export const SIZE_MODES = ['px', '%', 'fit-content'] as const;
export type SizeMode = (typeof SIZE_MODES)[number];
export type SizeValue = {
  mode: 'px' | '%';
  value: number;
};

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
  width?: SizeValue;
  height?: SizeValue;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
};

export const FLEX_DISPLAYS = ['flex', 'inline-flex'] as const;
export const FLEX_DIRECTIONS = ['row', 'row-reverse', 'column', 'column-reverse'] as const;
export const FLEX_WRAPS = ['nowrap', 'wrap', 'wrap-reverse'] as const;
export const FLEX_JUSTIFY_CONTENTS = [
  'flex-start',
  'flex-end',
  'center',
  'space-between',
  'space-around',
  'space-evenly',
] as const;
export const FLEX_ALIGN_ITEMS = ['stretch', 'flex-start', 'flex-end', 'center', 'baseline'] as const;
export const FLEX_ALIGN_CONTENTS = [
  'flex-start',
  'flex-end',
  'center',
  'space-between',
  'space-around',
  'space-evenly',
  'stretch',
] as const;
export const FLEX_ALIGN_SELFS = ['auto', 'stretch', 'flex-start', 'flex-end', 'center', 'baseline'] as const;

export type FlexDisplay = (typeof FLEX_DISPLAYS)[number];
export type FlexDirection = (typeof FLEX_DIRECTIONS)[number];
export type FlexWrap = (typeof FLEX_WRAPS)[number];
export type FlexJustifyContent = (typeof FLEX_JUSTIFY_CONTENTS)[number];
export type FlexAlignItems = (typeof FLEX_ALIGN_ITEMS)[number];
export type FlexAlignContent = (typeof FLEX_ALIGN_CONTENTS)[number];
export type FlexAlignSelf = (typeof FLEX_ALIGN_SELFS)[number];

export type FlexContainerStyle = {
  display?: FlexDisplay;
  flexDirection?: FlexDirection;
  flexWrap?: FlexWrap;
  justifyContent?: FlexJustifyContent;
  alignItems?: FlexAlignItems;
  alignContent?: FlexAlignContent;
  rowGap?: number;
  columnGap?: number;
};

export type FlexItemStyle = {
  order?: number;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: 'auto' | number;
  alignSelf?: FlexAlignSelf;
};

export type PageWidget =
  | { type: 'text'; id: string; value: string; style?: WidgetStyle; item?: FlexItemStyle }
  | { type: 'button'; id: string; text: string; style?: WidgetStyle; item?: FlexItemStyle }
  | {
      type: 'flex';
      id: string;
      children: PageWidget[];
      style?: WidgetStyle;
      flex?: FlexContainerStyle;
      item?: FlexItemStyle;
    };

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
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
] as const satisfies ReadonlyArray<keyof WidgetStyle>;

function attr(node: OrderedNode, name: string): string {
  const raw = node[':@']?.[`@_${name}`];
  return raw == null ? '' : String(raw);
}

function isTrue(value: string) {
  return value === 'true' || value === '1';
}

function parseNumber(value: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseNonNegative(value: string): number | undefined {
  const parsed = parseNumber(value);
  return parsed != null && parsed >= 0 ? parsed : undefined;
}

function parseInteger(value: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseEnum<T extends string>(value: string, allowed: readonly T[]): T | undefined {
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function parseRadius(node: OrderedNode, name: string, fallback?: number) {
  return parseNumber(attr(node, name)) ?? fallback;
}

export function parseSize(raw: string): SizeValue | undefined {
  const value = raw.trim().toLowerCase();
  if (!value || value === 'fit-content' || value === 'auto') {
    return undefined;
  }
  if (value.endsWith('%')) {
    const parsed = parseNonNegative(value.slice(0, -1));
    return parsed == null ? undefined : { mode: '%', value: parsed };
  }
  const parsed = parseNonNegative(value.endsWith('px') ? value.slice(0, -2) : value);
  return parsed == null ? undefined : { mode: 'px', value: parsed };
}

function formatSize(size: SizeValue): string {
  return size.mode === '%' ? `${size.value}%` : String(size.value);
}

type BoxEdges = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

function parseEdgeList(value: string): number[] {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => parseNumber(part))
    .filter((part): part is number => part != null);
}

function parseEdges(shorthand: string): BoxEdges | undefined {
  const parts = parseEdgeList(shorthand);
  if (parts.length === 1) {
    return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
  }
  if (parts.length === 2) {
    return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
  }
  if (parts.length === 3) {
    return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
  }
  if (parts.length >= 4) {
    return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
  }
  return undefined;
}

function writeEdges(
  attrs: Record<string, string>,
  name: 'margin' | 'padding',
  top?: number,
  right?: number,
  bottom?: number,
  left?: number,
) {
  if (top == null && right == null && bottom == null && left == null) {
    return;
  }
  if (top != null && top === right && right === bottom && bottom === left) {
    attrs[`@_${name}`] = String(top);
    return;
  }
  if (top != null) {
    attrs[`@_${name}-top`] = String(top);
  }
  if (right != null) {
    attrs[`@_${name}-right`] = String(right);
  }
  if (bottom != null) {
    attrs[`@_${name}-bottom`] = String(bottom);
  }
  if (left != null) {
    attrs[`@_${name}-left`] = String(left);
  }
}

function nodeList(value: unknown): OrderedNode[] {
  if (value == null || value === '') {
    return [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is OrderedNode => Boolean(item) && typeof item === 'object');
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
    if (
      (key === 'paddingTop' ||
        key === 'paddingRight' ||
        key === 'paddingBottom' ||
        key === 'paddingLeft') &&
      typeof value === 'number' &&
      value < 0
    ) {
      continue;
    }
    (next as Record<string, unknown>)[key] = value;
  }

  const width = compactSize(style.width);
  if (width) {
    next.width = width;
  }
  const height = compactSize(style.height);
  if (height) {
    next.height = height;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

export function compactSize(size: SizeValue | undefined): SizeValue | undefined {
  if (!size || (size.mode !== 'px' && size.mode !== '%')) {
    return undefined;
  }
  if (!Number.isFinite(size.value) || size.value < 0) {
    return undefined;
  }
  return { mode: size.mode, value: size.value };
}

export function compactFlexContainer(style: FlexContainerStyle | undefined): FlexContainerStyle | undefined {
  if (!style) {
    return undefined;
  }

  const next: FlexContainerStyle = {};
  if (style.display) {
    next.display = style.display;
  }
  if (style.flexDirection) {
    next.flexDirection = style.flexDirection;
  }
  if (style.flexWrap) {
    next.flexWrap = style.flexWrap;
  }
  if (style.justifyContent) {
    next.justifyContent = style.justifyContent;
  }
  if (style.alignItems) {
    next.alignItems = style.alignItems;
  }
  if (style.alignContent) {
    next.alignContent = style.alignContent;
  }
  if (style.rowGap != null && style.rowGap >= 0) {
    next.rowGap = style.rowGap;
  }
  if (style.columnGap != null && style.columnGap >= 0) {
    next.columnGap = style.columnGap;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

export function compactFlexItem(style: FlexItemStyle | undefined): FlexItemStyle | undefined {
  if (!style) {
    return undefined;
  }

  const next: FlexItemStyle = {};
  if (style.order != null && Number.isFinite(style.order)) {
    next.order = style.order;
  }
  if (style.flexGrow != null && Number.isFinite(style.flexGrow) && style.flexGrow >= 0) {
    next.flexGrow = style.flexGrow;
  }
  if (style.flexShrink != null && Number.isFinite(style.flexShrink) && style.flexShrink >= 0) {
    next.flexShrink = style.flexShrink;
  }
  if (style.flexBasis === 'auto') {
    next.flexBasis = 'auto';
  } else if (typeof style.flexBasis === 'number' && Number.isFinite(style.flexBasis) && style.flexBasis >= 0) {
    next.flexBasis = style.flexBasis;
  }
  if (style.alignSelf) {
    next.alignSelf = style.alignSelf;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function parseStyle(node: OrderedNode): WidgetStyle | undefined {
  const radius = parseNumber(attr(node, 'border-radius'));
  const margin = parseEdges(attr(node, 'margin'));
  const padding = parseEdges(attr(node, 'padding'));
  return compactWidgetStyle({
    color: attr(node, 'color') || undefined,
    textShadow: attr(node, 'text-shadow') || undefined,
    italic: isTrue(attr(node, 'italic')) || undefined,
    fontWeight: attr(node, 'font-weight') || undefined,
    underline: isTrue(attr(node, 'underline')) || undefined,
    lineThrough: isTrue(attr(node, 'line-through')) || undefined,
    background: attr(node, 'background') || undefined,
    borderWidth: parseNumber(attr(node, 'border-width')),
    borderStyle: attr(node, 'border-style') || undefined,
    borderColor: attr(node, 'border-color') || undefined,
    radiusTopLeft: parseRadius(node, 'border-top-left-radius', radius),
    radiusTopRight: parseRadius(node, 'border-top-right-radius', radius),
    radiusBottomRight: parseRadius(node, 'border-bottom-right-radius', radius),
    radiusBottomLeft: parseRadius(node, 'border-bottom-left-radius', radius),
    boxShadow: attr(node, 'box-shadow') || undefined,
    width: parseSize(attr(node, 'width')),
    height: parseSize(attr(node, 'height')),
    marginTop: parseNumber(attr(node, 'margin-top')) ?? margin?.top,
    marginRight: parseNumber(attr(node, 'margin-right')) ?? margin?.right,
    marginBottom: parseNumber(attr(node, 'margin-bottom')) ?? margin?.bottom,
    marginLeft: parseNumber(attr(node, 'margin-left')) ?? margin?.left,
    paddingTop: parseNonNegative(attr(node, 'padding-top')) ?? padding?.top,
    paddingRight: parseNonNegative(attr(node, 'padding-right')) ?? padding?.right,
    paddingBottom: parseNonNegative(attr(node, 'padding-bottom')) ?? padding?.bottom,
    paddingLeft: parseNonNegative(attr(node, 'padding-left')) ?? padding?.left,
  });
}

function parseFlex(node: OrderedNode): FlexContainerStyle | undefined {
  const gap = parseNonNegative(attr(node, 'gap'));
  return compactFlexContainer({
    display: parseEnum(attr(node, 'display'), FLEX_DISPLAYS),
    flexDirection: parseEnum(attr(node, 'flex-direction'), FLEX_DIRECTIONS),
    flexWrap: parseEnum(attr(node, 'flex-wrap'), FLEX_WRAPS),
    justifyContent: parseEnum(attr(node, 'justify-content'), FLEX_JUSTIFY_CONTENTS),
    alignItems: parseEnum(attr(node, 'align-items'), FLEX_ALIGN_ITEMS),
    alignContent: parseEnum(attr(node, 'align-content'), FLEX_ALIGN_CONTENTS),
    rowGap: parseNonNegative(attr(node, 'row-gap')) ?? gap,
    columnGap: parseNonNegative(attr(node, 'column-gap')) ?? gap,
  });
}

function parseItem(node: OrderedNode): FlexItemStyle | undefined {
  const basisRaw = attr(node, 'flex-basis');
  return compactFlexItem({
    order: parseInteger(attr(node, 'order')),
    flexGrow: parseNonNegative(attr(node, 'flex-grow')),
    flexShrink: parseNonNegative(attr(node, 'flex-shrink')),
    flexBasis: basisRaw === 'auto' ? 'auto' : parseNonNegative(basisRaw),
    alignSelf: parseEnum(attr(node, 'align-self'), FLEX_ALIGN_SELFS),
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
  if (compact.width) {
    attrs['@_width'] = formatSize(compact.width);
  }
  if (compact.height) {
    attrs['@_height'] = formatSize(compact.height);
  }
  writeEdges(attrs, 'margin', compact.marginTop, compact.marginRight, compact.marginBottom, compact.marginLeft);
  writeEdges(attrs, 'padding', compact.paddingTop, compact.paddingRight, compact.paddingBottom, compact.paddingLeft);
  return attrs;
}

function flexAttrs(style: FlexContainerStyle | undefined): Record<string, string> {
  const compact = compactFlexContainer(style);
  if (!compact) {
    return {};
  }

  const attrs: Record<string, string> = {};
  if (compact.display) {
    attrs['@_display'] = compact.display;
  }
  if (compact.flexDirection) {
    attrs['@_flex-direction'] = compact.flexDirection;
  }
  if (compact.flexWrap) {
    attrs['@_flex-wrap'] = compact.flexWrap;
  }
  if (compact.justifyContent) {
    attrs['@_justify-content'] = compact.justifyContent;
  }
  if (compact.alignItems) {
    attrs['@_align-items'] = compact.alignItems;
  }
  if (compact.alignContent) {
    attrs['@_align-content'] = compact.alignContent;
  }
  if (compact.rowGap != null && compact.columnGap != null && compact.rowGap === compact.columnGap) {
    attrs['@_gap'] = String(compact.rowGap);
  } else {
    if (compact.rowGap != null) {
      attrs['@_row-gap'] = String(compact.rowGap);
    }
    if (compact.columnGap != null) {
      attrs['@_column-gap'] = String(compact.columnGap);
    }
  }
  return attrs;
}

function itemAttrs(style: FlexItemStyle | undefined): Record<string, string> {
  const compact = compactFlexItem(style);
  if (!compact) {
    return {};
  }

  const attrs: Record<string, string> = {};
  if (compact.order != null) {
    attrs['@_order'] = String(compact.order);
  }
  if (compact.flexGrow != null) {
    attrs['@_flex-grow'] = String(compact.flexGrow);
  }
  if (compact.flexShrink != null) {
    attrs['@_flex-shrink'] = String(compact.flexShrink);
  }
  if (compact.flexBasis != null) {
    attrs['@_flex-basis'] = String(compact.flexBasis);
  }
  if (compact.alignSelf) {
    attrs['@_align-self'] = compact.alignSelf;
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
      return nodeList(node.page);
    }
  }

  throw new XmlParseError('XML does not contain a page root');
}

function parseWidgets(nodes: OrderedNode[], ids: { n: number }, asItem: boolean): PageWidget[] {
  const widgets: PageWidget[] = [];

  for (const child of nodes) {
    if (Object.prototype.hasOwnProperty.call(child, 'text')) {
      ids.n += 1;
      const style = parseStyle(child);
      const item = asItem ? parseItem(child) : undefined;
      widgets.push({
        type: 'text',
        id: attr(child, 'id') || `n${ids.n}`,
        value: attr(child, 'value'),
        ...(style ? { style } : {}),
        ...(item ? { item } : {}),
      });
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(child, 'button')) {
      ids.n += 1;
      const style = parseStyle(child);
      const item = asItem ? parseItem(child) : undefined;
      widgets.push({
        type: 'button',
        id: attr(child, 'id') || `n${ids.n}`,
        text: attr(child, 'text'),
        ...(style ? { style } : {}),
        ...(item ? { item } : {}),
      });
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(child, 'flex')) {
      ids.n += 1;
      const style = parseStyle(child);
      const flex = parseFlex(child);
      const item = asItem ? parseItem(child) : undefined;
      widgets.push({
        type: 'flex',
        id: attr(child, 'id') || `n${ids.n}`,
        children: parseWidgets(nodeList(child.flex), ids, true),
        ...(style ? { style } : {}),
        ...(flex ? { flex } : {}),
        ...(item ? { item } : {}),
      });
    }
  }

  return widgets;
}

function serializeWidgets(widgets: PageWidget[], ids: { n: number }, asItem: boolean): OrderedNode[] {
  return widgets.map((widget) => {
    ids.n += 1;
    const id = widget.id || `n${ids.n}`;
    const style = styleAttrs(widget.style);
    const item = asItem ? itemAttrs(widget.item) : {};
    if (widget.type === 'text') {
      return {
        text: [],
        ':@': { '@_id': id, '@_value': widget.value, ...style, ...item },
      };
    }
    if (widget.type === 'button') {
      return {
        button: [],
        ':@': { '@_id': id, '@_text': widget.text, ...style, ...item },
      };
    }
    return {
      flex: serializeWidgets(widget.children, ids, true),
      ':@': { '@_id': id, ...style, ...flexAttrs(widget.flex), ...item },
    };
  });
}

export function parsePageXml(xml: string): PageXmlDocument {
  const result = XMLValidator.validate(xml);
  if (result !== true) {
    throw new XmlParseError(result.err.msg);
  }

  return { widgets: parseWidgets(findPageChildren(pageParser.parse(xml)), { n: 0 }, false) };
}

export function serializePageXml(page: PageXmlDocument): string {
  return pageBuilder.build([
    {
      '?xml': [],
      ':@': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    },
    { page: serializeWidgets(page.widgets, { n: 0 }, false) },
  ]);
}

export const EMPTY_PAGE_XML = serializePageXml({ widgets: [] });

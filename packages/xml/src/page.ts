import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { XmlParseError } from './errors';
import { copyWidgetRuntimeMeta } from './runtime-meta';

export const SIZE_MODES = ['px', '%', 'fit-content'] as const;
export type SizeMode = (typeof SIZE_MODES)[number];
export type SizeValue = {
  mode: 'px' | '%';
  value: number;
};

export const BOX_LENGTH_MODES = ['px', '%', 'auto'] as const;
export type BoxLengthMode = (typeof BOX_LENGTH_MODES)[number];
export type BoxLength =
  | { mode: 'px'; value: number }
  | { mode: '%'; value: number }
  | { mode: 'auto' };

export const POSITION_MODES = ['static', 'relative', 'absolute', 'fixed', 'sticky'] as const;
export type PositionMode = (typeof POSITION_MODES)[number];
export type WidgetPosition = Exclude<PositionMode, 'static'>;

export const OVERFLOW_MODES = ['visible', 'hidden', 'scroll', 'auto'] as const;
export type OverflowMode = (typeof OVERFLOW_MODES)[number];
const STORED_POSITIONS = ['relative', 'absolute', 'fixed', 'sticky'] as const satisfies ReadonlyArray<WidgetPosition>;

export const ANGLE_UNITS = ['deg', 'rad', 'grad', 'turn'] as const;
export type AngleUnit = (typeof ANGLE_UNITS)[number];
export type AngleValue = { value: number; unit: AngleUnit };
const ANGLE_PATTERN = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(deg|rad|grad|turn)?$/i;

export type WidgetStyle = {
  color?: string;
  textShadow?: string;
  italic?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  underline?: boolean;
  lineThrough?: boolean;
  background?: string;
  borderTopWidth?: number;
  borderRightWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderStyle?: string;
  borderTopStyle?: string;
  borderRightStyle?: string;
  borderBottomStyle?: string;
  borderLeftStyle?: string;
  borderColor?: string;
  borderTopColor?: string;
  borderRightColor?: string;
  borderBottomColor?: string;
  borderLeftColor?: string;
  radiusTopLeft?: number;
  radiusTopRight?: number;
  radiusBottomRight?: number;
  radiusBottomLeft?: number;
  boxShadow?: string;
  width?: SizeValue;
  height?: SizeValue;
  overflow?: OverflowMode;
  position?: WidgetPosition;
  zIndex?: number;
  top?: BoxLength;
  right?: BoxLength;
  bottom?: BoxLength;
  left?: BoxLength;
  marginTop?: BoxLength;
  marginRight?: BoxLength;
  marginBottom?: BoxLength;
  marginLeft?: BoxLength;
  paddingTop?: BoxLength;
  paddingRight?: BoxLength;
  paddingBottom?: BoxLength;
  paddingLeft?: BoxLength;
  rotateX?: AngleValue;
  rotateY?: AngleValue;
  rotateZ?: AngleValue;
  transition?: number;
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

export const SWIPER_EASINGS = [
  'default',
  'linear',
  'easeInCubic',
  'easeOutCubic',
  'easeInOutCubic',
] as const;
export type SwiperEasing = (typeof SWIPER_EASINGS)[number];

export type SwiperStyle = {
  indicatorDots?: boolean;
  indicatorColor?: string;
  indicatorActiveColor?: string;
  autoplay?: boolean;
  current?: number;
  interval?: number;
  duration?: number;
  circular?: boolean;
  vertical?: boolean;
  previousMargin?: number;
  nextMargin?: number;
  displayMultipleItems?: number;
  snapToEdge?: boolean;
  easingFunction?: SwiperEasing;
};

export const TABLE_ALIGNS = ['start', 'center', 'end'] as const;
export type TableAlign = (typeof TABLE_ALIGNS)[number];
export const TABLE_VALIGNS = ['top', 'middle', 'bottom'] as const;
export type TableValign = (typeof TABLE_VALIGNS)[number];
export const MIN_TABLE_TRACK = 24;
export const DEFAULT_TABLE_COLUMN_WIDTH = 80;
export const DEFAULT_TABLE_ROW_HEIGHT = 36;
export const DEFAULT_TABLE_HEADER_HEIGHT = 36;
export const DEFAULT_TABLE_WIDTH: SizeValue = { mode: 'px', value: 240 };
export const DEFAULT_TABLE_HEIGHT: SizeValue = { mode: 'px', value: 120 };

export const TABLE_LINE_STYLES = ['solid', 'dashed', 'dotted'] as const;
export type TableLineStyle = (typeof TABLE_LINE_STYLES)[number];
export type TableLine = {
  width?: number;
  style?: TableLineStyle;
  color?: string;
};
export type TableLines = {
  header?: TableLine;
  row?: TableLine;
  column?: TableLine;
};

export function compactTableLine(line: TableLine | undefined): TableLine | undefined {
  if (!line) {
    return undefined;
  }
  const next: TableLine = {};
  if (typeof line.width === 'number' && Number.isFinite(line.width) && line.width > 0) {
    next.width = Math.min(20, Math.trunc(line.width));
  }
  if (line.style && (TABLE_LINE_STYLES as readonly string[]).includes(line.style)) {
    next.style = line.style;
  }
  const color = line.color?.trim();
  if (color) {
    next.color = color;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function compactTableLines(lines: TableLines | undefined): TableLines | undefined {
  if (!lines) {
    return undefined;
  }
  const next: TableLines = {};
  for (const kind of ['header', 'row', 'column'] as const) {
    const line = compactTableLine(lines[kind]);
    if (line) {
      next[kind] = line;
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export type WidgetContentProps = {
  value?: string;
  text?: string;
  src?: string;
  size?: number;
};

export type WidgetStateDelta = {
  id: string;
  name?: string;
  transition?: number;
  appliedState?: string;
  props?: WidgetContentProps;
  style?: WidgetStyle;
  flex?: FlexContainerStyle;
  item?: FlexItemStyle;
  swiper?: SwiperStyle;
  states?: WidgetStateDelta[];
};

export type WidgetStateRole = 'owner' | 'descendant';

export type WidgetStateViewing = {
  ownerId: string;
  state: string | null;
};

type WidgetStates = {
  states?: WidgetStateDelta[];
  stateOverrides?: WidgetStateDelta[];
  appliedState?: string;
  stateFn?: string;
  hoverStateId?: string;
  transition?: number;
};

export const LOOP_FROMS = ['data', 'literal'] as const;
export type WidgetLoopFrom = (typeof LOOP_FROMS)[number];
export const DEFAULT_LOOP_ITEM = 'item';
export const DEFAULT_LOOP_INDEX = 'index';

export type WidgetLoop = {
  from: WidgetLoopFrom;
  source: string;
  key: string;
  item?: string;
  index?: string;
};

type WidgetCommon = WidgetStates & { loop?: WidgetLoop; hidden?: boolean; alias?: string };

export type PageWidget =
  | ({ type: 'image'; id: string; src: string; style?: WidgetStyle; item?: FlexItemStyle } & WidgetCommon)
  | ({ type: 'icon'; id: string; src: string; size?: number; style?: WidgetStyle; item?: FlexItemStyle } & WidgetCommon)
  | ({ type: 'text'; id: string; value: string; style?: WidgetStyle; item?: FlexItemStyle } & WidgetCommon)
  | ({ type: 'button'; id: string; text: string; style?: WidgetStyle; item?: FlexItemStyle } & WidgetCommon)
  | ({
      type: 'flex';
      id: string;
      children: PageWidget[];
      style?: WidgetStyle;
      flex?: FlexContainerStyle;
      item?: FlexItemStyle;
    } & WidgetCommon)
  | ({
      type: 'swiper';
      id: string;
      children: PageWidget[];
      style?: WidgetStyle;
      swiper?: SwiperStyle;
      item?: FlexItemStyle;
    } & WidgetCommon)
  | ({
      type: 'swiper-item';
      id: string;
      children: PageWidget[];
      style?: WidgetStyle;
    } & WidgetCommon)
  | ({
      type: 'table';
      id: string;
      children: PageWidget[];
      style?: WidgetStyle;
      freezeHeader?: boolean;
      freezeFooter?: boolean;
      headerHeight?: number;
      lines?: TableLines;
      item?: FlexItemStyle;
    } & WidgetCommon)
  | ({
      type: 'th';
      id: string;
      value: string;
      children: PageWidget[];
      width?: number;
      align?: TableAlign;
      valign?: TableValign;
      style?: WidgetStyle;
    } & WidgetCommon)
  | ({
      type: 'tr';
      id: string;
      children: PageWidget[];
      height?: number;
      style?: WidgetStyle;
    } & WidgetCommon)
  | ({
      type: 'td';
      id: string;
      value: string;
      children: PageWidget[];
      align?: TableAlign;
      valign?: TableValign;
      style?: WidgetStyle;
    } & WidgetCommon);

type WidgetParent = 'page' | 'flex' | 'swiper' | 'swiper-item' | 'table' | 'tr' | 'th' | 'td';

function hasFlexItem(
  widget: PageWidget,
): widget is Exclude<PageWidget, { type: 'swiper-item' | 'th' | 'tr' | 'td' }> {
  return widget.type !== 'swiper-item' && widget.type !== 'th' && widget.type !== 'tr' && widget.type !== 'td';
}

export type PageStyle = {
  background?: string;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
};

export const PAGE_DATA_TYPES = ['num', 'str', 'bool', 'arr', 'obj', 'widget'] as const;
export type PageDataType = (typeof PAGE_DATA_TYPES)[number];

export type PageVariable = {
  type: PageDataType;
  name: string;
  value: string;
  desc?: string;
  watch?: string;
};

export const PAGE_I18N_DIRS = ['ltr', 'rtl'] as const;
export type PageI18nDir = (typeof PAGE_I18N_DIRS)[number];

export type PageI18nLang = {
  key: string;
  name: string;
  dir: PageI18nDir;
};

export type PageI18nEntry = {
  key: string;
  values: Record<string, string>;
};

export type PageI18nGroup = {
  key: string;
  entries: PageI18nEntry[];
};

export type PageI18n = {
  langs: PageI18nLang[];
  groups: PageI18nGroup[];
};

const I18N_COPY_EXPR = /^\s*\$t\("([^".]+)\.([^".]+)"\)\s*$/;

export function isI18nKey(value: string): boolean {
  const key = value.trim();
  return key.length > 0 && !key.includes('.') && !key.includes('"');
}

export function isI18nCopyExpr(raw: string): boolean {
  return I18N_COPY_EXPR.test(raw);
}

export function isJsIdentifier(name: string): boolean {
  if (!/^[\p{ID_Start}$_][\p{ID_Continue}$]*$/u.test(name)) {
    return false;
  }
  try {
    new Function(`function ${name}(){}`);
    return true;
  } catch {
    return false;
  }
}

function isLoopAliasName(name: string): boolean {
  return isJsIdentifier(name) && name !== 'data' && name !== 't';
}

function loopAliasOrDefault(raw: string | undefined, fallback: string): string {
  const name = raw?.trim() ?? '';
  return name && isLoopAliasName(name) ? name : fallback;
}

export function compactLoop(loop: WidgetLoop | undefined | null): WidgetLoop | undefined {
  if (!loop) {
    return undefined;
  }
  const from = LOOP_FROMS.includes(loop.from) ? loop.from : undefined;
  const source = loop.source?.trim() ?? '';
  const key = loop.key?.trim() ?? '';
  if (!from || !source || !key) {
    return undefined;
  }
  let item = loopAliasOrDefault(loop.item, DEFAULT_LOOP_ITEM);
  let index = loopAliasOrDefault(loop.index, DEFAULT_LOOP_INDEX);
  if (item === index) {
    if (item !== DEFAULT_LOOP_INDEX) {
      index = DEFAULT_LOOP_INDEX;
    } else {
      item = DEFAULT_LOOP_ITEM;
    }
  }
  return {
    from,
    source,
    key,
    ...(item !== DEFAULT_LOOP_ITEM ? { item } : {}),
    ...(index !== DEFAULT_LOOP_INDEX ? { index } : {}),
  };
}

export function isLoopConfigured(loop: WidgetLoop | undefined | null): loop is WidgetLoop {
  return compactLoop(loop) != null;
}

const STATE_NAME_IDENT = /^[\p{ID_Start}$_][\p{ID_Continue}$]*$/u;

export function compactStateFn(source: string | undefined | null): string | undefined {
  const body = source?.trim();
  return body || undefined;
}

export function isStateFnConfigured(source: string | undefined | null): boolean {
  return compactStateFn(source) != null;
}

function parseHostStateFn(raw: string, ownedIds: string[]): string | undefined {
  const value = raw.trim();
  if (!value) {
    return undefined;
  }
  if (ownedIds.includes(value) && STATE_NAME_IDENT.test(value)) {
    return `return ${JSON.stringify(value)}`;
  }
  return value;
}

export function loopItemName(loop: WidgetLoop): string {
  return loop.item ?? DEFAULT_LOOP_ITEM;
}

export function loopIndexName(loop: WidgetLoop): string {
  return loop.index ?? DEFAULT_LOOP_INDEX;
}

export function formatI18nCopy(groupKey: string, entryKey: string): string {
  return `$t("${groupKey}.${entryKey}")`;
}

export function compactPageI18n(catalog: PageI18n | undefined): PageI18n | undefined {
  if (!catalog) {
    return undefined;
  }
  const langs = catalog.langs.filter((lang) => isI18nKey(lang.key));
  const groups = catalog.groups
    .filter((group) => isI18nKey(group.key))
    .map((group) => ({
      key: group.key.trim(),
      entries: group.entries.filter((entry) => isI18nKey(entry.key)),
    }));
  if (langs.length === 0 && groups.length === 0) {
    return undefined;
  }
  return {
    langs: langs.map((lang) => ({
      key: lang.key.trim(),
      name: lang.name,
      dir: lang.dir === 'rtl' ? 'rtl' : 'ltr',
    })),
    groups,
  };
}

export function resolveI18nCopy(raw: string, catalog: PageI18n | undefined, locale?: string): string {
  const match = I18N_COPY_EXPR.exec(raw);
  if (!match) {
    return raw;
  }
  if (!catalog || !locale) {
    return '';
  }
  const group = catalog.groups.find((item) => item.key === match[1]);
  const entry = group?.entries.find((item) => item.key === match[2]);
  return entry?.values[locale] ?? '';
}

export function pickPageLocale(catalog: PageI18n | undefined, runtimeLang?: string): string | undefined {
  const langs = catalog?.langs ?? [];
  if (langs.length === 0) {
    return undefined;
  }
  const raw = (runtimeLang ?? '').trim();
  if (raw) {
    const exact = langs.find((lang) => lang.key === raw);
    if (exact) {
      return exact.key;
    }
    const prefix = raw.split(/[-_]/)[0] ?? '';
    if (prefix) {
      const prefixed = langs.find((lang) => lang.key === prefix);
      if (prefixed) {
        return prefixed.key;
      }
    }
  }
  return langs[0]?.key;
}

export function pageI18nDir(catalog: PageI18n | undefined, locale?: string): PageI18nDir {
  if (!catalog || !locale) {
    return 'ltr';
  }
  return catalog.langs.find((lang) => lang.key === locale)?.dir === 'rtl' ? 'rtl' : 'ltr';
}

export type PageLangSnapshot = {
  key: string;
  name: string;
  dir: PageI18nDir;
  values: Record<string, string>;
};

export function isPageLangSnapshot(value: unknown): value is PageLangSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const row = value as { key?: unknown; name?: unknown; values?: unknown };
  return (
    typeof row.key === 'string' &&
    typeof row.name === 'string' &&
    Boolean(row.values) &&
    typeof row.values === 'object' &&
    !Array.isArray(row.values)
  );
}

export function pageI18nFromSnapshot(snapshot: PageLangSnapshot): PageI18n {
  const groups: PageI18nGroup[] = [];
  const groupMap = new Map<string, PageI18nGroup>();
  for (const [path, text] of Object.entries(snapshot.values)) {
    if (typeof text !== 'string' || !text) {
      continue;
    }
    const dot = path.indexOf('.');
    if (dot <= 0) {
      continue;
    }
    const groupKey = path.slice(0, dot);
    const entryKey = path.slice(dot + 1);
    if (!isI18nKey(groupKey) || !isI18nKey(entryKey)) {
      continue;
    }
    let group = groupMap.get(groupKey);
    if (!group) {
      group = { key: groupKey, entries: [] };
      groupMap.set(groupKey, group);
      groups.push(group);
    }
    let entry = group.entries.find((item) => item.key === entryKey);
    if (!entry) {
      entry = { key: entryKey, values: {} };
      group.entries.push(entry);
    }
    entry.values[snapshot.key] = text;
  }
  return {
    langs: [
      {
        key: snapshot.key,
        name: snapshot.name,
        dir: snapshot.dir === 'rtl' ? 'rtl' : 'ltr',
      },
    ],
    groups,
  };
}

export type PageXmlDocument = {
  widgets: PageWidget[];
  style?: PageStyle;
  data?: PageVariable[];
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

const BOOLEAN_STYLE_KEYS = new Set(['italic', 'underline', 'lineThrough']);

const STYLE_KEYS = [
  'color',
  'textShadow',
  'italic',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'underline',
  'lineThrough',
  'background',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'borderTopStyle',
  'borderRightStyle',
  'borderBottomStyle',
  'borderLeftStyle',
  'borderColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'radiusTopLeft',
  'radiusTopRight',
  'radiusBottomRight',
  'radiusBottomLeft',
  'boxShadow',
  'overflow',
  'position',
  'zIndex',
  'top',
  'right',
  'bottom',
  'left',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'rotateX',
  'rotateY',
  'rotateZ',
] as const satisfies ReadonlyArray<keyof WidgetStyle>;

function attr(node: OrderedNode, name: string): string {
  const raw = node[':@']?.[`@_${name}`];
  return raw == null ? '' : String(raw);
}

function parseWidgetLoop(node: OrderedNode): { loop?: WidgetLoop } {
  const loop = compactLoop({
    from: attr(node, 'loop-from') as WidgetLoopFrom,
    source: attr(node, 'loop-src'),
    key: attr(node, 'loop-key'),
    item: attr(node, 'loop-item') || undefined,
    index: attr(node, 'loop-index') || undefined,
  });
  return loop ? { loop } : {};
}

function parseWidgetHidden(node: OrderedNode): { hidden?: true } {
  return isTrue(attr(node, 'hidden')) ? { hidden: true } : {};
}

function parseWidgetAlias(node: OrderedNode): { alias?: string } {
  const raw = attr(node, 'alias')?.trim();
  return raw ? { alias: raw } : {};
}

function loopAttrs(loop: WidgetLoop | undefined): Record<string, string> {
  const compact = compactLoop(loop);
  if (!compact) {
    return {};
  }
  return {
    '@_loop-from': compact.from,
    '@_loop-src': compact.source,
    '@_loop-key': compact.key,
    ...(compact.item ? { '@_loop-item': compact.item } : {}),
    ...(compact.index ? { '@_loop-index': compact.index } : {}),
  };
}

function isTrue(value: string) {
  return value === 'true' || value === '1';
}

function parseBoolAttr(value: string | undefined): boolean | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  return isTrue(value);
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

function parseNonNegativeInteger(value: string): number | undefined {
  const parsed = parseInteger(value);
  return parsed != null && parsed >= 0 ? parsed : undefined;
}

function parsePositiveInteger(value: string): number | undefined {
  const parsed = parseInteger(value);
  return parsed != null && parsed > 0 ? parsed : undefined;
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

export function parseBoxLength(
  raw: string,
  options?: { allowNegative?: boolean; allowAuto?: boolean },
): BoxLength | undefined {
  const value = raw.trim().toLowerCase();
  if (!value) {
    return undefined;
  }
  if (value === 'auto') {
    return options?.allowAuto === false ? undefined : { mode: 'auto' };
  }
  const allowNegative = options?.allowNegative !== false;
  if (value.endsWith('%')) {
    const parsed = parseNumber(value.slice(0, -1));
    if (parsed == null || (!allowNegative && parsed < 0)) {
      return undefined;
    }
    return { mode: '%', value: parsed };
  }
  const parsed = parseNumber(value.endsWith('px') ? value.slice(0, -2) : value);
  if (parsed == null || (!allowNegative && parsed < 0)) {
    return undefined;
  }
  return { mode: 'px', value: parsed };
}

export function formatBoxLength(length: BoxLength): string {
  if (length.mode === 'auto') {
    return 'auto';
  }
  if (length.mode === '%') {
    return `${length.value}%`;
  }
  return String(length.value);
}

export function boxLengthCss(length: BoxLength): string {
  if (length.mode === 'px') {
    return `${length.value}px`;
  }
  return formatBoxLength(length);
}

export function parseAngle(raw: string): AngleValue | undefined {
  const value = raw.trim();
  if (!value) {
    return undefined;
  }
  const match = ANGLE_PATTERN.exec(value);
  if (!match) {
    return undefined;
  }
  const amount = Number.parseFloat(match[1]);
  const unit = (match[2] ? match[2].toLowerCase() : 'deg') as AngleUnit;
  return compactAngle({ value: amount, unit });
}

export function formatAngle(angle: AngleValue): string {
  return `${angle.value}${angle.unit}`;
}

export function angleCss(angle: AngleValue): string {
  return formatAngle(angle);
}

function angleToDeg(angle: AngleValue): number {
  switch (angle.unit) {
    case 'rad':
      return (angle.value * 180) / Math.PI;
    case 'grad':
      return angle.value * 0.9;
    case 'turn':
      return angle.value * 360;
    default:
      return angle.value;
  }
}

export function convertAngle(angle: AngleValue, unit: AngleUnit): AngleValue {
  if (angle.unit === unit) {
    return { value: angle.value, unit };
  }
  const deg = angleToDeg(angle);
  switch (unit) {
    case 'rad':
      return { value: (deg * Math.PI) / 180, unit };
    case 'grad':
      return { value: deg / 0.9, unit };
    case 'turn':
      return { value: deg / 360, unit };
    default:
      return { value: deg, unit: 'deg' };
  }
}

export function compactAngle(value: unknown): AngleValue | undefined {
  if (value == null || value === false || value === '') {
    return undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value !== 0 ? { value, unit: 'deg' } : undefined;
  }
  if (typeof value !== 'object') {
    return undefined;
  }
  const unit = (value as AngleValue).unit;
  if (!(ANGLE_UNITS as readonly string[]).includes(unit)) {
    return undefined;
  }
  const amount = (value as { value?: unknown }).value;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0) {
    return undefined;
  }
  return { value: amount, unit };
}

export function boxLengthsEqual(a?: BoxLength, b?: BoxLength) {
  if (a == null || b == null) {
    return a === b;
  }
  if (a.mode !== b.mode) {
    return false;
  }
  if (a.mode === 'auto' || b.mode === 'auto') {
    return true;
  }
  return a.value === b.value;
}

function normalizeBoxLength(value: unknown): BoxLength | undefined {
  if (value == null || value === false || value === '') {
    return undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { mode: 'px', value } : undefined;
  }
  if (typeof value !== 'object') {
    return undefined;
  }
  const mode = (value as BoxLength).mode;
  if (mode === 'auto') {
    return { mode: 'auto' };
  }
  if (mode !== 'px' && mode !== '%') {
    return undefined;
  }
  const amount = (value as { value?: unknown }).value;
  return typeof amount === 'number' && Number.isFinite(amount) ? { mode, value: amount } : undefined;
}

export function compactBoxLength(
  value: unknown,
  kind: 'margin' | 'padding' | 'inset',
): BoxLength | undefined {
  const length = normalizeBoxLength(value);
  if (!length) {
    return undefined;
  }
  if (length.mode === 'auto') {
    return kind === 'margin' ? length : undefined;
  }
  if (kind === 'padding' && length.value < 0) {
    return undefined;
  }
  return length;
}

type BoxEdges = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

type LengthEdges = {
  top?: BoxLength;
  right?: BoxLength;
  bottom?: BoxLength;
  left?: BoxLength;
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

function parseLengthEdgeList(value: string, options?: { allowNegative?: boolean; allowAuto?: boolean }): BoxLength[] {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => parseBoxLength(part, options))
    .filter((part): part is BoxLength => Boolean(part));
}

function parseLengthEdges(
  shorthand: string,
  options?: { allowNegative?: boolean; allowAuto?: boolean },
): LengthEdges | undefined {
  const parts = parseLengthEdgeList(shorthand, options);
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

function writeInsets(
  attrs: Record<string, string>,
  top?: BoxLength,
  right?: BoxLength,
  bottom?: BoxLength,
  left?: BoxLength,
) {
  if (top == null && right == null && bottom == null && left == null) {
    return;
  }
  if (top != null && boxLengthsEqual(top, right) && boxLengthsEqual(right, bottom) && boxLengthsEqual(bottom, left)) {
    attrs['@_inset'] = formatBoxLength(top);
    return;
  }
  if (top != null) {
    attrs['@_top'] = formatBoxLength(top);
  }
  if (right != null) {
    attrs['@_right'] = formatBoxLength(right);
  }
  if (bottom != null) {
    attrs['@_bottom'] = formatBoxLength(bottom);
  }
  if (left != null) {
    attrs['@_left'] = formatBoxLength(left);
  }
}

function writeEdges(
  attrs: Record<string, string>,
  name: 'margin' | 'padding',
  top?: BoxLength,
  right?: BoxLength,
  bottom?: BoxLength,
  left?: BoxLength,
) {
  if (top == null && right == null && bottom == null && left == null) {
    return;
  }
  if (top != null && boxLengthsEqual(top, right) && boxLengthsEqual(right, bottom) && boxLengthsEqual(bottom, left)) {
    attrs[`@_${name}`] = formatBoxLength(top);
    return;
  }
  if (top != null) {
    attrs[`@_${name}-top`] = formatBoxLength(top);
  }
  if (right != null) {
    attrs[`@_${name}-right`] = formatBoxLength(right);
  }
  if (bottom != null) {
    attrs[`@_${name}-bottom`] = formatBoxLength(bottom);
  }
  if (left != null) {
    attrs[`@_${name}-left`] = formatBoxLength(left);
  }
}

function writeUniformOrSides(
  attrs: Record<string, string>,
  shorthand: string,
  sides: { top?: string; right?: string; bottom?: string; left?: string },
  names: { top: string; right: string; bottom: string; left: string },
) {
  const { top, right, bottom, left } = sides;
  if (top && top === right && right === bottom && bottom === left) {
    attrs[`@_${shorthand}`] = top;
    return;
  }
  if (top) {
    attrs[`@_${names.top}`] = top;
  }
  if (right) {
    attrs[`@_${names.right}`] = right;
  }
  if (bottom) {
    attrs[`@_${names.bottom}`] = bottom;
  }
  if (left) {
    attrs[`@_${names.left}`] = left;
  }
}

function writeBorderWidths(
  attrs: Record<string, string>,
  top?: number,
  right?: number,
  bottom?: number,
  left?: number,
) {
  if (top == null && right == null && bottom == null && left == null) {
    return;
  }
  if (top != null && top === right && right === bottom && bottom === left) {
    attrs['@_border-width'] = String(top);
    return;
  }
  if (top != null) {
    attrs['@_border-top-width'] = String(top);
  }
  if (right != null) {
    attrs['@_border-right-width'] = String(right);
  }
  if (bottom != null) {
    attrs['@_border-bottom-width'] = String(bottom);
  }
  if (left != null) {
    attrs['@_border-left-width'] = String(left);
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
    if (value == null || value === '' || (value === false && !BOOLEAN_STYLE_KEYS.has(key))) {
      continue;
    }
    if (key === 'position' && !STORED_POSITIONS.includes(value as WidgetPosition)) {
      continue;
    }
    if (key === 'overflow' && !(OVERFLOW_MODES as readonly string[]).includes(value as string)) {
      continue;
    }
    if (
      key === 'top' ||
      key === 'right' ||
      key === 'bottom' ||
      key === 'left' ||
      key === 'marginTop' ||
      key === 'marginRight' ||
      key === 'marginBottom' ||
      key === 'marginLeft' ||
      key === 'paddingTop' ||
      key === 'paddingRight' ||
      key === 'paddingBottom' ||
      key === 'paddingLeft'
    ) {
      const kind =
        key === 'top' || key === 'right' || key === 'bottom' || key === 'left'
          ? 'inset'
          : key.startsWith('padding')
            ? 'padding'
            : 'margin';
      const length = compactBoxLength(value, kind);
      if (length) {
        (next as Record<string, unknown>)[key] = length;
      }
      continue;
    }
    if (key === 'rotateX' || key === 'rotateY' || key === 'rotateZ') {
      const angle = compactAngle(value);
      if (angle) {
        (next as Record<string, unknown>)[key] = angle;
      }
      continue;
    }
    if (key === 'zIndex') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        continue;
      }
      next.zIndex = Math.trunc(value);
      continue;
    }
    if (
      key === 'fontSize' &&
      typeof value === 'number' &&
      (!Number.isFinite(value) || value <= 0)
    ) {
      continue;
    }
    if (
      (key === 'radiusTopLeft' ||
        key === 'radiusTopRight' ||
        key === 'radiusBottomRight' ||
        key === 'radiusBottomLeft') &&
      typeof value === 'number' &&
      value <= 0
    ) {
      continue;
    }
    if (
      (key === 'borderTopWidth' ||
        key === 'borderRightWidth' ||
        key === 'borderBottomWidth' ||
        key === 'borderLeftWidth') &&
      typeof value === 'number' &&
      value < 0
    ) {
      continue;
    }
    if (
      (key === 'borderStyle' ||
        key === 'borderTopStyle' ||
        key === 'borderRightStyle' ||
        key === 'borderBottomStyle' ||
        key === 'borderLeftStyle') &&
      value !== 'solid' &&
      value !== 'dashed' &&
      value !== 'dotted' &&
      !(typeof value === 'string' && value.includes('{{'))
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

  if (!next.position) {
    delete next.top;
    delete next.right;
    delete next.bottom;
    delete next.left;
    delete next.zIndex;
  }

  if (next.borderStyle) {
    next.borderTopStyle ??= next.borderStyle;
    next.borderRightStyle ??= next.borderStyle;
    next.borderBottomStyle ??= next.borderStyle;
    next.borderLeftStyle ??= next.borderStyle;
    delete next.borderStyle;
  }
  if (next.borderColor) {
    next.borderTopColor ??= next.borderColor;
    next.borderRightColor ??= next.borderColor;
    next.borderBottomColor ??= next.borderColor;
    next.borderLeftColor ??= next.borderColor;
    delete next.borderColor;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

export const DEFAULT_SWIPER_WIDTH: SizeValue = { mode: '%', value: 100 };
export const DEFAULT_SWIPER_HEIGHT: SizeValue = { mode: 'px', value: 150 };

export function sanitizeWidgetStyle(
  type: PageWidget['type'],
  style: WidgetStyle | undefined,
): WidgetStyle | undefined {
  const next: WidgetStyle = { ...(style ?? {}) };
  if (type === 'swiper-item') {
    delete next.width;
    delete next.height;
    delete next.marginTop;
    delete next.marginRight;
    delete next.marginBottom;
    delete next.marginLeft;
    delete next.borderTopWidth;
    delete next.borderRightWidth;
    delete next.borderBottomWidth;
    delete next.borderLeftWidth;
    delete next.borderStyle;
    delete next.borderTopStyle;
    delete next.borderRightStyle;
    delete next.borderBottomStyle;
    delete next.borderLeftStyle;
    delete next.borderColor;
    delete next.borderTopColor;
    delete next.borderRightColor;
    delete next.borderBottomColor;
    delete next.borderLeftColor;
    delete next.radiusTopLeft;
    delete next.radiusTopRight;
    delete next.radiusBottomRight;
    delete next.radiusBottomLeft;
    delete next.position;
    delete next.zIndex;
    delete next.top;
    delete next.right;
    delete next.bottom;
    delete next.left;
  }
  if (type === 'swiper') {
    delete next.paddingTop;
    delete next.paddingRight;
    delete next.paddingBottom;
    delete next.paddingLeft;
    delete next.overflow;
    next.width = compactSize(next.width) ?? DEFAULT_SWIPER_WIDTH;
    next.height = compactSize(next.height) ?? DEFAULT_SWIPER_HEIGHT;
  }
  if (type === 'image' || type === 'swiper-item' || type === 'th' || type === 'tr' || type === 'td') {
    delete next.overflow;
  }
  if (type === 'th' || type === 'tr' || type === 'td') {
    delete next.width;
    delete next.height;
    delete next.borderTopWidth;
    delete next.borderRightWidth;
    delete next.borderBottomWidth;
    delete next.borderLeftWidth;
    delete next.borderStyle;
    delete next.borderTopStyle;
    delete next.borderRightStyle;
    delete next.borderBottomStyle;
    delete next.borderLeftStyle;
    delete next.borderColor;
    delete next.borderTopColor;
    delete next.borderRightColor;
    delete next.borderBottomColor;
    delete next.borderLeftColor;
    delete next.marginTop;
    delete next.marginRight;
    delete next.marginBottom;
    delete next.marginLeft;
    delete next.position;
    delete next.zIndex;
    delete next.top;
    delete next.right;
    delete next.bottom;
    delete next.left;
    delete next.rotateX;
    delete next.rotateY;
    delete next.rotateZ;
  }
  if (type === 'table') {
    next.width = compactSize(next.width) ?? DEFAULT_TABLE_WIDTH;
    next.height = compactSize(next.height) ?? DEFAULT_TABLE_HEIGHT;
    if (next.overflow === 'auto') {
      delete next.overflow;
    }
  }
  return compactWidgetStyle(next);
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

const PAGE_STYLE_KEYS = [
  'background',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
] as const satisfies ReadonlyArray<keyof PageStyle>;

export function compactPageStyle(style: PageStyle | undefined): PageStyle | undefined {
  if (!style) {
    return undefined;
  }

  const next: PageStyle = {};
  for (const key of PAGE_STYLE_KEYS) {
    const value = style[key];
    if (value == null || value === '') {
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

  return Object.keys(next).length > 0 ? next : undefined;
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

export function compactSwiper(style: SwiperStyle | undefined): SwiperStyle | undefined {
  if (!style) {
    return undefined;
  }

  const next: SwiperStyle = {};
  if (style.indicatorDots) {
    next.indicatorDots = true;
  }
  if (style.indicatorColor) {
    next.indicatorColor = style.indicatorColor;
  }
  if (style.indicatorActiveColor) {
    next.indicatorActiveColor = style.indicatorActiveColor;
  }
  if (style.autoplay) {
    next.autoplay = true;
  }
  if (style.current != null && Number.isInteger(style.current) && style.current >= 0) {
    next.current = style.current;
  }
  if (style.interval != null && Number.isInteger(style.interval) && style.interval > 0) {
    next.interval = style.interval;
  }
  if (style.duration != null && Number.isInteger(style.duration) && style.duration >= 0) {
    next.duration = style.duration;
  }
  if (style.circular) {
    next.circular = true;
  }
  if (style.vertical) {
    next.vertical = true;
  }
  if (style.previousMargin != null && Number.isFinite(style.previousMargin) && style.previousMargin >= 0) {
    next.previousMargin = style.previousMargin;
  }
  if (style.nextMargin != null && Number.isFinite(style.nextMargin) && style.nextMargin >= 0) {
    next.nextMargin = style.nextMargin;
  }
  if (
    style.displayMultipleItems != null &&
    Number.isInteger(style.displayMultipleItems) &&
    style.displayMultipleItems >= 1
  ) {
    next.displayMultipleItems = style.displayMultipleItems;
  }
  if (style.snapToEdge) {
    next.snapToEdge = true;
  }
  if (style.easingFunction) {
    next.easingFunction = style.easingFunction;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

export function compactWidgetProps(props: WidgetContentProps | undefined): WidgetContentProps | undefined {
  if (!props) {
    return undefined;
  }
  const next: WidgetContentProps = {};
  if (typeof props.value === 'string') {
    next.value = props.value;
  }
  if (typeof props.text === 'string') {
    next.text = props.text;
  }
  if (typeof props.src === 'string' && props.src) {
    next.src = props.src;
  }
  if (typeof props.size === 'number' && Number.isFinite(props.size) && props.size > 0) {
    next.size = props.size;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function parseStyle(node: OrderedNode): WidgetStyle | undefined {
  const radius = parseNumber(attr(node, 'border-radius'));
  const margin = parseLengthEdges(attr(node, 'margin'), { allowAuto: true });
  const padding = parseLengthEdges(attr(node, 'padding'), { allowNegative: false, allowAuto: false });
  const border = parseEdges(attr(node, 'border-width'));
  const inset = parseLengthEdges(attr(node, 'inset'), { allowAuto: false });
  return compactWidgetStyle({
    color: attr(node, 'color') || undefined,
    textShadow: attr(node, 'text-shadow') || undefined,
    italic: parseBoolAttr(attr(node, 'italic')),
    fontFamily: attr(node, 'font-family') || undefined,
    fontSize: parseNonNegative(attr(node, 'font-size')),
    fontWeight: attr(node, 'font-weight') || undefined,
    underline: parseBoolAttr(attr(node, 'underline')),
    lineThrough: parseBoolAttr(attr(node, 'line-through')),
    background: attr(node, 'background') || undefined,
    borderTopWidth: parseNonNegative(attr(node, 'border-top-width')) ?? border?.top,
    borderRightWidth: parseNonNegative(attr(node, 'border-right-width')) ?? border?.right,
    borderBottomWidth: parseNonNegative(attr(node, 'border-bottom-width')) ?? border?.bottom,
    borderLeftWidth: parseNonNegative(attr(node, 'border-left-width')) ?? border?.left,
    borderStyle: attr(node, 'border-style') || undefined,
    borderTopStyle: attr(node, 'border-top-style') || undefined,
    borderRightStyle: attr(node, 'border-right-style') || undefined,
    borderBottomStyle: attr(node, 'border-bottom-style') || undefined,
    borderLeftStyle: attr(node, 'border-left-style') || undefined,
    borderColor: attr(node, 'border-color') || undefined,
    borderTopColor: attr(node, 'border-top-color') || undefined,
    borderRightColor: attr(node, 'border-right-color') || undefined,
    borderBottomColor: attr(node, 'border-bottom-color') || undefined,
    borderLeftColor: attr(node, 'border-left-color') || undefined,
    radiusTopLeft: parseRadius(node, 'border-top-left-radius', radius),
    radiusTopRight: parseRadius(node, 'border-top-right-radius', radius),
    radiusBottomRight: parseRadius(node, 'border-bottom-right-radius', radius),
    radiusBottomLeft: parseRadius(node, 'border-bottom-left-radius', radius),
    boxShadow: attr(node, 'box-shadow') || undefined,
    width: parseSize(attr(node, 'width')),
    height: parseSize(attr(node, 'height')),
    overflow: parseEnum(attr(node, 'overflow'), OVERFLOW_MODES),
    position: parseEnum(attr(node, 'position'), STORED_POSITIONS),
    zIndex: parseInteger(attr(node, 'z-index')),
    top: parseBoxLength(attr(node, 'top'), { allowAuto: false }) ?? inset?.top,
    right: parseBoxLength(attr(node, 'right'), { allowAuto: false }) ?? inset?.right,
    bottom: parseBoxLength(attr(node, 'bottom'), { allowAuto: false }) ?? inset?.bottom,
    left: parseBoxLength(attr(node, 'left'), { allowAuto: false }) ?? inset?.left,
    marginTop: parseBoxLength(attr(node, 'margin-top'), { allowAuto: true }) ?? margin?.top,
    marginRight: parseBoxLength(attr(node, 'margin-right'), { allowAuto: true }) ?? margin?.right,
    marginBottom: parseBoxLength(attr(node, 'margin-bottom'), { allowAuto: true }) ?? margin?.bottom,
    marginLeft: parseBoxLength(attr(node, 'margin-left'), { allowAuto: true }) ?? margin?.left,
    paddingTop: parseBoxLength(attr(node, 'padding-top'), { allowNegative: false, allowAuto: false }) ?? padding?.top,
    paddingRight: parseBoxLength(attr(node, 'padding-right'), { allowNegative: false, allowAuto: false }) ?? padding?.right,
    paddingBottom: parseBoxLength(attr(node, 'padding-bottom'), { allowNegative: false, allowAuto: false }) ?? padding?.bottom,
    paddingLeft: parseBoxLength(attr(node, 'padding-left'), { allowNegative: false, allowAuto: false }) ?? padding?.left,
    rotateX: parseAngle(attr(node, 'rotate-x')),
    rotateY: parseAngle(attr(node, 'rotate-y')),
    rotateZ: parseAngle(attr(node, 'rotate-z')),
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

function parseTableTrack(raw: string, omitDefault: number): number | undefined {
  const parsed = parseNonNegative(raw);
  if (parsed == null) {
    return undefined;
  }
  const rounded = Math.round(parsed);
  if (rounded < MIN_TABLE_TRACK || rounded === omitDefault) {
    return undefined;
  }
  return rounded;
}

function tableTrackAttr(name: string, value: number | undefined, omitDefault: number): Record<string, string> {
  if (value == null || value < MIN_TABLE_TRACK || value === omitDefault) {
    return {};
  }
  return { [`@_${name}`]: String(Math.round(value)) };
}

function parseTableLines(node: OrderedNode): TableLines | undefined {
  const lines: TableLines = {};
  for (const kind of ['header', 'row', 'column'] as const) {
    const line = compactTableLine({
      width: parseNonNegativeInteger(attr(node, `${kind}-line-width`)),
      style: parseEnum(attr(node, `${kind}-line-style`), TABLE_LINE_STYLES),
      color: attr(node, `${kind}-line-color`) || undefined,
    });
    if (line) {
      lines[kind] = line;
    }
  }
  return compactTableLines(lines);
}

function tableLineAttrs(lines: TableLines | undefined): Record<string, string> {
  const compact = compactTableLines(lines);
  if (!compact) {
    return {};
  }
  const attrs: Record<string, string> = {};
  for (const kind of ['header', 'row', 'column'] as const) {
    const line = compact[kind];
    if (!line) {
      continue;
    }
    if (line.width != null) {
      attrs[`@_${kind}-line-width`] = String(line.width);
    }
    if (line.style) {
      attrs[`@_${kind}-line-style`] = line.style;
    }
    if (line.color) {
      attrs[`@_${kind}-line-color`] = line.color;
    }
  }
  return attrs;
}

function cellAlignAttrs(align: TableAlign | undefined, valign: TableValign | undefined): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (align && align !== 'start') {
    attrs['@_align'] = align;
  }
  if (valign && valign !== 'middle') {
    attrs['@_valign'] = valign;
  }
  return attrs;
}

function orderTableChildren(children: PageWidget[]): PageWidget[] {
  return [...children.filter((child) => child.type === 'th'), ...children.filter((child) => child.type === 'tr')];
}

function trimExtraCells(children: PageWidget[]): PageWidget[] {
  const columns = children.filter((child) => child.type === 'th').length;
  return children.map((child) => {
    if (child.type !== 'tr') {
      return child;
    }
    const cells = child.children.filter((cell) => cell.type === 'td').slice(0, columns);
    return cells.length === child.children.length ? child : { ...child, children: cells };
  });
}

function parseSwiper(node: OrderedNode): SwiperStyle | undefined {
  return compactSwiper({
    indicatorDots: isTrue(attr(node, 'indicator-dots')) || undefined,
    indicatorColor: attr(node, 'indicator-color') || undefined,
    indicatorActiveColor: attr(node, 'indicator-active-color') || undefined,
    autoplay: isTrue(attr(node, 'autoplay')) || undefined,
    current: parseNonNegativeInteger(attr(node, 'current')),
    interval: parsePositiveInteger(attr(node, 'interval')),
    duration: parseNonNegativeInteger(attr(node, 'duration')),
    circular: isTrue(attr(node, 'circular')) || undefined,
    vertical: isTrue(attr(node, 'vertical')) || undefined,
    previousMargin: parseNonNegative(attr(node, 'previous-margin')),
    nextMargin: parseNonNegative(attr(node, 'next-margin')),
    displayMultipleItems: parsePositiveInteger(attr(node, 'display-multiple-items')),
    snapToEdge: isTrue(attr(node, 'snap-to-edge')) || undefined,
    easingFunction: parseEnum(attr(node, 'easing-function'), SWIPER_EASINGS),
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
  if (compact.fontFamily) {
    attrs['@_font-family'] = compact.fontFamily;
  }
  if (compact.fontSize != null) {
    attrs['@_font-size'] = String(compact.fontSize);
  }
  if (compact.fontWeight) {
    attrs['@_font-weight'] = compact.fontWeight;
  }
  if (compact.italic != null) {
    attrs['@_italic'] = compact.italic ? 'true' : 'false';
  }
  if (compact.underline != null) {
    attrs['@_underline'] = compact.underline ? 'true' : 'false';
  }
  if (compact.lineThrough != null) {
    attrs['@_line-through'] = compact.lineThrough ? 'true' : 'false';
  }
  if (compact.textShadow) {
    attrs['@_text-shadow'] = compact.textShadow;
  }
  if (compact.background) {
    attrs['@_background'] = compact.background;
  }
  writeBorderWidths(
    attrs,
    compact.borderTopWidth,
    compact.borderRightWidth,
    compact.borderBottomWidth,
    compact.borderLeftWidth,
  );
  writeUniformOrSides(attrs, 'border-style', {
    top: compact.borderTopStyle,
    right: compact.borderRightStyle,
    bottom: compact.borderBottomStyle,
    left: compact.borderLeftStyle,
  }, {
    top: 'border-top-style',
    right: 'border-right-style',
    bottom: 'border-bottom-style',
    left: 'border-left-style',
  });
  writeUniformOrSides(attrs, 'border-color', {
    top: compact.borderTopColor,
    right: compact.borderRightColor,
    bottom: compact.borderBottomColor,
    left: compact.borderLeftColor,
  }, {
    top: 'border-top-color',
    right: 'border-right-color',
    bottom: 'border-bottom-color',
    left: 'border-left-color',
  });
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
  if (compact.overflow) {
    attrs['@_overflow'] = compact.overflow;
  }
  if (compact.position) {
    attrs['@_position'] = compact.position;
  }
  if (compact.zIndex != null) {
    attrs['@_z-index'] = String(compact.zIndex);
  }
  writeInsets(attrs, compact.top, compact.right, compact.bottom, compact.left);
  writeEdges(attrs, 'margin', compact.marginTop, compact.marginRight, compact.marginBottom, compact.marginLeft);
  writeEdges(attrs, 'padding', compact.paddingTop, compact.paddingRight, compact.paddingBottom, compact.paddingLeft);
  if (compact.rotateX) {
    attrs['@_rotate-x'] = formatAngle(compact.rotateX);
  }
  if (compact.rotateY) {
    attrs['@_rotate-y'] = formatAngle(compact.rotateY);
  }
  if (compact.rotateZ) {
    attrs['@_rotate-z'] = formatAngle(compact.rotateZ);
  }
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

function swiperAttrs(style: SwiperStyle | undefined): Record<string, string> {
  const compact = compactSwiper(style);
  if (!compact) {
    return {};
  }

  const attrs: Record<string, string> = {};
  if (compact.indicatorDots) {
    attrs['@_indicator-dots'] = 'true';
  }
  if (compact.indicatorColor) {
    attrs['@_indicator-color'] = compact.indicatorColor;
  }
  if (compact.indicatorActiveColor) {
    attrs['@_indicator-active-color'] = compact.indicatorActiveColor;
  }
  if (compact.autoplay) {
    attrs['@_autoplay'] = 'true';
  }
  if (compact.current != null) {
    attrs['@_current'] = String(compact.current);
  }
  if (compact.interval != null) {
    attrs['@_interval'] = String(compact.interval);
  }
  if (compact.duration != null) {
    attrs['@_duration'] = String(compact.duration);
  }
  if (compact.circular) {
    attrs['@_circular'] = 'true';
  }
  if (compact.vertical) {
    attrs['@_vertical'] = 'true';
  }
  if (compact.previousMargin != null) {
    attrs['@_previous-margin'] = String(compact.previousMargin);
  }
  if (compact.nextMargin != null) {
    attrs['@_next-margin'] = String(compact.nextMargin);
  }
  if (compact.displayMultipleItems != null) {
    attrs['@_display-multiple-items'] = String(compact.displayMultipleItems);
  }
  if (compact.snapToEdge) {
    attrs['@_snap-to-edge'] = 'true';
  }
  if (compact.easingFunction) {
    attrs['@_easing-function'] = compact.easingFunction;
  }
  return attrs;
}

function findPageRoot(parsed: unknown): OrderedNode {
  if (!Array.isArray(parsed)) {
    throw new XmlParseError('XML does not contain a page root');
  }

  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const node = item as OrderedNode;
    if (Object.prototype.hasOwnProperty.call(node, 'page')) {
      return node;
    }
  }

  throw new XmlParseError('XML does not contain a page root');
}

function parsePageStyle(node: OrderedNode): PageStyle | undefined {
  const padding = parseEdges(attr(node, 'padding'));
  return compactPageStyle({
    background: attr(node, 'background') || undefined,
    paddingTop: parseNonNegative(attr(node, 'padding-top')) ?? padding?.top,
    paddingRight: parseNonNegative(attr(node, 'padding-right')) ?? padding?.right,
    paddingBottom: parseNonNegative(attr(node, 'padding-bottom')) ?? padding?.bottom,
    paddingLeft: parseNonNegative(attr(node, 'padding-left')) ?? padding?.left,
  });
}

function pageStyleAttrs(style: PageStyle | undefined): Record<string, string> {
  const compact = compactPageStyle(style);
  if (!compact) {
    return {};
  }

  const attrs: Record<string, string> = {};
  if (compact.background) {
    attrs['@_background'] = compact.background;
  }
  writeEdges(
    attrs,
    'padding',
    compact.paddingTop != null ? { mode: 'px', value: compact.paddingTop } : undefined,
    compact.paddingRight != null ? { mode: 'px', value: compact.paddingRight } : undefined,
    compact.paddingBottom != null ? { mode: 'px', value: compact.paddingBottom } : undefined,
    compact.paddingLeft != null ? { mode: 'px', value: compact.paddingLeft } : undefined,
  );
  return attrs;
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

function parsePageData(nodes: OrderedNode[]): PageVariable[] | undefined {
  const dataChild = nodes.find((child) => Object.prototype.hasOwnProperty.call(child, 'data'));
  if (!dataChild) {
    return undefined;
  }

  const variables = nodeList(dataChild.data).flatMap((child) => {
    for (const type of PAGE_DATA_TYPES) {
      if (!Object.prototype.hasOwnProperty.call(child, type)) {
        continue;
      }
      const name = attr(child, 'n').trim();
      if (!name) {
        return [];
      }
      const raw = elementText(child[type]);
      const value = type === 'bool' ? (raw === '1' ? '1' : '0') : raw;
      const desc = attr(child, 'desc').trim();
      const watch = type === 'bool' ? attr(child, 'watch') : '';
      const variable: PageVariable = {
        type,
        name,
        value,
        ...(desc ? { desc } : {}),
        ...(watch ? { watch } : {}),
      };
      return [variable];
    }
    return [];
  });

  return variables.length > 0 ? variables : undefined;
}

function splitPageChildren(nodes: OrderedNode[]): {
  widgets: OrderedNode[];
  data?: PageVariable[];
} {
  const data = parsePageData(nodes);
  const widgets = nodes.filter(
    (child) =>
      !Object.prototype.hasOwnProperty.call(child, 'data') && !Object.prototype.hasOwnProperty.call(child, 'i18n'),
  );
  return { widgets, ...(data ? { data } : {}) };
}

function serializePageData(variables: PageVariable[]): OrderedNode {
  return {
    data: variables.map((variable) => {
      const attrs: Record<string, string> = { '@_n': variable.name };
      const desc = variable.desc?.trim();
      if (desc) {
        attrs['@_desc'] = desc;
      }
      if (variable.type === 'bool' && variable.watch) {
        attrs['@_watch'] = variable.watch;
      }
      return {
        [variable.type]: [{ '#text': variable.value }],
        ':@': attrs,
      };
    }),
  };
}

function stateFieldEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (left == null || right == null) {
    return left == null && right == null;
  }
  if (typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }
  const a = left as { mode?: unknown; value?: unknown; unit?: unknown };
  const b = right as { mode?: unknown; value?: unknown; unit?: unknown };
  if (typeof a.unit === 'string' || typeof b.unit === 'string') {
    return a.unit === b.unit && a.value === b.value;
  }
  if (a.mode === 'auto' || b.mode === 'auto') {
    return boxLengthsEqual(left as BoxLength, right as BoxLength);
  }
  if (typeof a.mode === 'string' && typeof b.mode === 'string') {
    return a.mode === b.mode && a.value === b.value;
  }
  return false;
}

function diffRecord<T extends object>(
  base: T | undefined,
  next: T | undefined,
  compact: (value: T | undefined) => T | undefined,
): T | undefined {
  const compactNext = compact(next);
  if (!compactNext) {
    return undefined;
  }
  const compactBase = compact(base) ?? ({} as T);
  const delta = {} as T;
  for (const key of Object.keys(compactNext) as Array<keyof T>) {
    if (!stateFieldEqual(compactNext[key], compactBase[key])) {
      delta[key] = compactNext[key];
    }
  }
  return Object.keys(delta).length > 0 ? compact(delta) : undefined;
}

export type WidgetStateFields = {
  props?: WidgetContentProps;
  style?: WidgetStyle;
  flex?: FlexContainerStyle;
  item?: FlexItemStyle;
  swiper?: SwiperStyle;
};

export function nestedOwnedStates(widget: PageWidget): WidgetStateDelta[] {
  return (widget.stateOverrides ?? []).flatMap((item) => item.states ?? []);
}

export function ownedStateIds(widget: PageWidget): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const state of [...(widget.states ?? []), ...nestedOwnedStates(widget)]) {
    if (seen.has(state.id)) {
      continue;
    }
    seen.add(state.id);
    ids.push(state.id);
  }
  return ids;
}

export function findOwnedDelta(widget: PageWidget, id: string): WidgetStateDelta | undefined {
  const owned = widget.states?.find((item) => item.id === id);
  if (owned) {
    return owned;
  }
  return nestedOwnedStates(widget).find((item) => item.id === id);
}

export function findOwnedStateByName(widget: PageWidget, name: string): WidgetStateDelta | undefined {
  const owned = widget.states?.find((item) => item.name === name);
  if (owned) {
    return owned;
  }
  return nestedOwnedStates(widget).find((item) => item.name === name);
}

export function hasOwnedStates(widget: PageWidget): boolean {
  return Boolean(widget.states?.length || nestedOwnedStates(widget).length);
}

export function appliedStateId(widget: PageWidget): string | null {
  if (!widget.appliedState || !widget.states?.some((state) => state.id === widget.appliedState)) {
    return null;
  }
  return widget.appliedState;
}

export function nestedAppliedStateId(override: WidgetStateDelta | undefined): string | null {
  if (!override?.appliedState || !override.states?.some((state) => state.id === override.appliedState)) {
    return null;
  }
  return override.appliedState;
}

function mergeStyle(base?: WidgetStyle, overlay?: WidgetStyle): WidgetStyle | undefined {
  if (!overlay) {
    return compactWidgetStyle(base);
  }
  return compactWidgetStyle({ ...base, ...overlay });
}

function mergeFlex(base?: FlexContainerStyle, overlay?: FlexContainerStyle): FlexContainerStyle | undefined {
  if (!overlay) {
    return compactFlexContainer(base);
  }
  return compactFlexContainer({ ...base, ...overlay });
}

function mergeItem(base?: FlexItemStyle, overlay?: FlexItemStyle): FlexItemStyle | undefined {
  if (!overlay) {
    return compactFlexItem(base);
  }
  return compactFlexItem({ ...base, ...overlay });
}

function mergeSwiper(base?: SwiperStyle, overlay?: SwiperStyle): SwiperStyle | undefined {
  if (!overlay) {
    return compactSwiper(base);
  }
  return compactSwiper({ ...base, ...overlay });
}

function mergeProps(base?: WidgetContentProps, overlay?: WidgetContentProps): WidgetContentProps | undefined {
  if (!overlay) {
    return compactWidgetProps(base);
  }
  return compactWidgetProps({ ...base, ...overlay });
}

function widgetBaseProps(widget: PageWidget): WidgetContentProps | undefined {
  return compactWidgetProps({
    ...('value' in widget ? { value: widget.value } : {}),
    ...('text' in widget ? { text: widget.text } : {}),
    ...('src' in widget ? { src: widget.src } : {}),
    ...('size' in widget && widget.size != null ? { size: widget.size } : {}),
  });
}

export type WidgetStateLayer = {
  id: string;
  role: WidgetStateRole;
};

export function resolveWidgetState(
  widget: PageWidget,
  stateId: string | null | undefined,
  role: WidgetStateRole,
): WidgetStateFields {
  return resolveWidgetStateStack(widget, stateId ? [{ id: stateId, role }] : []);
}

function widgetFieldBase(widget: PageWidget): WidgetStateFields {
  return {
    props: widgetBaseProps(widget),
    style: compactWidgetStyle(widget.style),
    flex: widget.type === 'flex' ? compactFlexContainer(widget.flex) : undefined,
    item: hasFlexItem(widget) ? compactFlexItem(widget.item) : undefined,
    swiper: widget.type === 'swiper' ? compactSwiper(widget.swiper) : undefined,
  };
}

export function resolveWidgetStateStack(widget: PageWidget, layers: WidgetStateLayer[]): WidgetStateFields {
  let props = widgetBaseProps(widget);
  let style = compactWidgetStyle(widget.style);
  let flex = widget.type === 'flex' ? compactFlexContainer(widget.flex) : undefined;
  let item = hasFlexItem(widget) ? compactFlexItem(widget.item) : undefined;
  let swiper = widget.type === 'swiper' ? compactSwiper(widget.swiper) : undefined;
  let activeOverride: WidgetStateDelta | undefined;
  for (const layer of layers) {
    let delta: WidgetStateDelta | undefined;
    if (layer.role === 'owner') {
      delta = widget.states?.find((item) => item.id === layer.id) ?? activeOverride?.states?.find((item) => item.id === layer.id);
    } else {
      delta = widget.stateOverrides?.find((item) => item.id === layer.id);
      activeOverride = delta;
    }
    props = mergeProps(props, delta?.props);
    style = mergeStyle(style, delta?.style);
    flex = widget.type === 'flex' ? mergeFlex(flex, delta?.flex) : undefined;
    item = hasFlexItem(widget) ? mergeItem(item, delta?.item) : undefined;
    swiper = widget.type === 'swiper' ? mergeSwiper(swiper, delta?.swiper) : undefined;
  }
  return { props, style, flex, item, swiper };
}

export function diffWidgetState(
  widget: PageWidget,
  next: WidgetStateFields,
  base?: WidgetStateFields,
): WidgetStateDelta | Pick<WidgetStateDelta, 'props' | 'style' | 'flex' | 'item' | 'swiper'> {
  const origin = base ?? widgetFieldBase(widget);
  const props = diffRecord(origin.props, next.props, compactWidgetProps);
  const style = diffRecord(origin.style, next.style, compactWidgetStyle);
  const flex = widget.type === 'flex' ? diffRecord(origin.flex, next.flex, compactFlexContainer) : undefined;
  const item = hasFlexItem(widget) ? diffRecord(origin.item, next.item, compactFlexItem) : undefined;
  const swiper = widget.type === 'swiper' ? diffRecord(origin.swiper, next.swiper, compactSwiper) : undefined;
  return {
    ...(props ? { props } : {}),
    ...(style ? { style } : {}),
    ...(flex ? { flex } : {}),
    ...(item ? { item } : {}),
    ...(swiper ? { swiper } : {}),
  };
}

function compactTransition(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.round(value);
}

function stateTransition(widget: PageWidget, id: string | null | undefined): number | undefined {
  if (!id) {
    return compactTransition(widget.transition);
  }
  return compactTransition(findOwnedDelta(widget, id)?.transition);
}

function applyResolvedProps(widget: PageWidget, props: WidgetContentProps | undefined): PageWidget {
  if (!props) {
    return widget;
  }
  if (widget.type === 'text') {
    return props.value != null ? { ...widget, value: props.value } : widget;
  }
  if (widget.type === 'button') {
    return props.text != null ? { ...widget, text: props.text } : widget;
  }
  if (widget.type === 'image') {
    return props.src != null ? { ...widget, src: props.src } : widget;
  }
  if (widget.type === 'icon') {
    let next = widget;
    if (props.src != null) {
      next = { ...next, src: props.src };
    }
    if (props.size != null) {
      next = { ...next, size: props.size };
    }
    return next;
  }
  if (widget.type === 'th' || widget.type === 'td') {
    return props.value != null ? { ...widget, value: props.value } : widget;
  }
  return widget;
}

function withResolvedFields(
  widget: PageWidget,
  fields: WidgetStateFields,
  transition?: number,
): PageWidget {
  let next = applyResolvedProps(widget, fields.props) as PageWidget;
  next = { ...next };
  copyWidgetRuntimeMeta(widget, next);
  if (fields.style) {
    next.style = fields.style;
  } else {
    delete next.style;
  }
  if (next.type === 'flex') {
    if (fields.flex) {
      next.flex = fields.flex;
    } else {
      delete next.flex;
    }
  }
  if (hasFlexItem(next)) {
    if (fields.item) {
      next.item = fields.item;
    } else {
      delete next.item;
    }
  }
  if (next.type === 'swiper') {
    if (fields.swiper) {
      next.swiper = fields.swiper;
    } else {
      delete next.swiper;
    }
  }
  const duration = compactTransition(transition);
  if (duration) {
    next.style = { ...(next.style ?? {}), transition: duration };
  }
  return next;
}

function normalizeViewing(
  viewing?: WidgetStateViewing | WidgetStateViewing[] | null,
): WidgetStateViewing[] {
  if (!viewing) {
    return [];
  }
  return Array.isArray(viewing) ? viewing : [viewing];
}

export type ResolveWidgetTreeOptions = {
  appliedStateFor?: (widget: PageWidget) => string | null;
  stateLayersSink?: WeakMap<object, WidgetStateLayer[]>;
};

function ownerActiveState(
  widget: PageWidget,
  viewing: WidgetStateViewing[],
  appliedStateFor?: (widget: PageWidget) => string | null,
): string | null {
  const hit = viewing.find((item) => item.ownerId === widget.id);
  if (hit) {
    return hit.state;
  }
  if (appliedStateFor) {
    return appliedStateFor(widget);
  }
  return appliedStateId(widget);
}

function layerRole(widget: PageWidget, id: string): WidgetStateRole {
  return findOwnedDelta(widget, id) ? 'owner' : 'descendant';
}

function stackTransition(
  widget: PageWidget,
  layers: WidgetStateLayer[],
  inheritedTransition?: number,
): number | undefined {
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    if (layers[i].role === 'owner') {
      const duration = stateTransition(widget, layers[i].id);
      if (duration) {
        return duration;
      }
    }
  }
  return inheritedTransition;
}

function resolveWidgetNode(
  widget: PageWidget,
  inheritedIds: string[],
  viewing: WidgetStateViewing[],
  inheritedTransition: number | undefined,
  appliedStateFor?: (widget: PageWidget) => string | null,
  stateLayersSink?: WeakMap<object, WidgetStateLayer[]>,
): PageWidget {
  const ownState = ownerActiveState(widget, viewing, appliedStateFor);
  const layers: WidgetStateLayer[] = [];
  for (const id of inheritedIds) {
    const role = layerRole(widget, id);
    layers.push({ id, role });
  }
  if (ownState) {
    layers.push({ id: ownState, role: layerRole(widget, ownState) });
  }
  const transition =
    (ownState ? stateTransition(widget, ownState) : undefined) ??
    compactTransition(widget.transition) ??
    stackTransition(widget, layers, inheritedTransition);
  const next = withResolvedFields(widget, resolveWidgetStateStack(widget, layers), transition);
  stateLayersSink?.set(next, layers);
  if ('children' in next) {
    const childIds = ownState && !inheritedIds.includes(ownState) ? [...inheritedIds, ownState] : inheritedIds;
    const childTransition = transition;
    next.children = next.children.map((child) =>
      resolveWidgetNode(child, childIds, viewing, childTransition, appliedStateFor, stateLayersSink),
    );
  }
  return next;
}

export function resolveWidgetTree(
  widgets: PageWidget[],
  viewing?: WidgetStateViewing | WidgetStateViewing[] | null,
  options?: ResolveWidgetTreeOptions,
): PageWidget[] {
  const list = normalizeViewing(viewing);
  return widgets.map((widget) =>
    resolveWidgetNode(widget, [], list, undefined, options?.appliedStateFor, options?.stateLayersSink),
  );
}

function parseStateProps(node: OrderedNode): WidgetContentProps | undefined {
  const attrs = node[':@'] ?? {};
  const props: WidgetContentProps = {};
  if (Object.prototype.hasOwnProperty.call(attrs, '@_value')) {
    props.value = String(attrs['@_value']);
  }
  if (Object.prototype.hasOwnProperty.call(attrs, '@_text')) {
    props.text = String(attrs['@_text']);
  }
  if (Object.prototype.hasOwnProperty.call(attrs, '@_src')) {
    const src = String(attrs['@_src']);
    if (src) {
      props.src = src;
    }
  }
  if (Object.prototype.hasOwnProperty.call(attrs, '@_size')) {
    const num = parseNumber(String(attrs['@_size']));
    if (num != null && num > 0) {
      props.size = num;
    }
  }
  return compactWidgetProps(props);
}

function parseStateDelta(node: OrderedNode): WidgetStateDelta | undefined {
  const tag = Object.prototype.hasOwnProperty.call(node, '__') ? '__' : '_';
  const rawId = attr(node, 'id').trim();
  const rawName = attr(node, 'name').trim();
  // Legacy drafts only carried name: backfill id from name.
  const id = rawId || rawName;
  if (!id) {
    return undefined;
  }
  const props = parseStateProps(node);
  const style = parseStyle(node);
  const flex = parseFlex(node);
  const item = parseItem(node);
  const swiper = parseSwiper(node);
  const transition = tag === '_' ? compactTransition(parseNonNegativeInteger(attr(node, 'transition'))) : undefined;
  const nested: WidgetStateDelta[] = [];
  const seen = new Set<string>();
  if (tag === '__') {
    for (const child of nodeList(node.__)) {
      if (!Object.prototype.hasOwnProperty.call(child, '_')) {
        continue;
      }
      const inner = parseStateDelta(child);
      if (inner && !seen.has(inner.id)) {
        seen.add(inner.id);
        nested.push(inner);
      }
    }
  }
  return {
    id,
    // Owner declarations carry a display name; overrides reference by id only.
    ...(tag === '_' ? { name: rawName || id } : {}),
    ...(transition ? { transition } : {}),
    ...(props ? { props } : {}),
    ...(style ? { style } : {}),
    ...(flex ? { flex } : {}),
    ...(item ? { item } : {}),
    ...(swiper ? { swiper } : {}),
    ...(nested.length > 0 ? { states: nested } : {}),
  };
}

function splitStateNodes(nodes: OrderedNode[]): {
  states: WidgetStateDelta[];
  overrides: WidgetStateDelta[];
  rest: OrderedNode[];
} {
  const states: WidgetStateDelta[] = [];
  const seen = new Set<string>();
  const overrides: WidgetStateDelta[] = [];
  const overrideSeen = new Set<string>();
  const rest: OrderedNode[] = [];
  for (const node of nodes) {
    if (Object.prototype.hasOwnProperty.call(node, '_')) {
      const delta = parseStateDelta(node);
      if (delta && !seen.has(delta.id)) {
        seen.add(delta.id);
        states.push(delta);
      }
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(node, '__')) {
      const delta = parseStateDelta(node);
      if (delta && !overrideSeen.has(delta.id)) {
        overrideSeen.add(delta.id);
        overrides.push(delta);
      }
      continue;
    }
    rest.push(node);
  }
  return { states, overrides, rest };
}

function propsAttrs(props: WidgetContentProps | undefined): Record<string, string> {
  const compact = compactWidgetProps(props);
  if (!compact) {
    return {};
  }
  const attrs: Record<string, string> = {};
  if (compact.value != null) {
    attrs['@_value'] = compact.value;
  }
  if (compact.text != null) {
    attrs['@_text'] = compact.text;
  }
  if (compact.src) {
    attrs['@_src'] = compact.src;
  }
  if (compact.size != null) {
    attrs['@_size'] = String(compact.size);
  }
  return attrs;
}

function compactDeltaForWrite(widget: PageWidget, delta: WidgetStateDelta, base?: WidgetStateFields): WidgetStateDelta {
  const origin = base ?? widgetFieldBase(widget);
  const resolved: WidgetStateFields = {
    props: compactWidgetProps({ ...origin.props, ...delta.props }),
    style: compactWidgetStyle({ ...origin.style, ...delta.style }),
    flex: widget.type === 'flex' ? compactFlexContainer({ ...origin.flex, ...delta.flex }) : undefined,
    item: hasFlexItem(widget) ? compactFlexItem({ ...origin.item, ...delta.item }) : undefined,
    swiper: widget.type === 'swiper' ? compactSwiper({ ...origin.swiper, ...delta.swiper }) : undefined,
  };
  return {
    id: delta.id,
    ...(delta.name != null ? { name: delta.name } : {}),
    ...(compactTransition(delta.transition) ? { transition: compactTransition(delta.transition) } : {}),
    ...diffWidgetState(widget, resolved, origin),
  };
}

function serializeDeltaNode(
  tag: '_' | '__',
  delta: WidgetStateDelta,
  widget: PageWidget,
  asItem: boolean,
  base?: WidgetStateFields,
): OrderedNode | null {
  const compact = compactDeltaForWrite(widget, delta, base);
  const attrs: Record<string, string> = {
    '@_id': compact.id,
    ...(tag === '_' && compact.name != null ? { '@_name': compact.name } : {}),
    ...(tag === '_' && compact.transition != null ? { '@_transition': String(compact.transition) } : {}),
    ...propsAttrs(compact.props),
    ...styleAttrs(compact.style),
    ...(widget.type === 'flex' ? flexAttrs(compact.flex) : {}),
    ...(asItem && hasFlexItem(widget) ? itemAttrs(compact.item) : {}),
    ...(widget.type === 'swiper' ? swiperAttrs(compact.swiper) : {}),
  };
  const nestedBase: WidgetStateFields = {
    props: compactWidgetProps({ ...((base ?? widgetFieldBase(widget)).props ?? {}), ...(compact.props ?? {}) }),
    style: compactWidgetStyle({ ...((base ?? widgetFieldBase(widget)).style ?? {}), ...(compact.style ?? {}) }),
    flex: widget.type === 'flex' ? compactFlexContainer({ ...((base ?? widgetFieldBase(widget)).flex ?? {}), ...(compact.flex ?? {}) }) : undefined,
    item: hasFlexItem(widget)
      ? compactFlexItem({ ...((base ?? widgetFieldBase(widget)).item ?? {}), ...(compact.item ?? {}) })
      : undefined,
    swiper:
      widget.type === 'swiper'
        ? compactSwiper({ ...((base ?? widgetFieldBase(widget)).swiper ?? {}), ...(compact.swiper ?? {}) })
        : undefined,
  };
  const nested =
    tag === '__'
      ? (delta.states ?? [])
          .map((item) => serializeDeltaNode('_', item, widget, asItem, nestedBase))
          .filter((node): node is OrderedNode => Boolean(node))
      : [];
  if (tag === '__' && Object.keys(attrs).length === 1 && nested.length === 0) {
    return null;
  }
  return { [tag]: nested, ':@': attrs };
}

function uniqueOverrideStates(widget: PageWidget): WidgetStateDelta[] {
  return (widget.stateOverrides ?? []).map((item) => {
    const used = new Set((widget.states ?? []).map((state) => state.id));
    const nested = (item.states ?? []).filter((state) => {
      if (used.has(state.id)) {
        return false;
      }
      used.add(state.id);
      return true;
    });
    const next: WidgetStateDelta = { ...item };
    if (nested.length > 0) {
      next.states = nested;
    } else {
      delete next.states;
    }
    return next;
  });
}

function serializeStateChildren(widget: PageWidget, ids: { n: number }, parent: WidgetParent): OrderedNode[] {
  const asItem = parent === 'flex';
  const owned = (widget.states ?? [])
    .map((delta) => serializeDeltaNode('_', delta, widget, asItem))
    .filter((node): node is OrderedNode => Boolean(node));
  const overrides = uniqueOverrideStates(widget)
    .map((delta) => serializeDeltaNode('__', delta, widget, asItem))
    .filter((node): node is OrderedNode => Boolean(node));
  const childParent: WidgetParent =
    widget.type === 'flex'
      ? 'flex'
      : widget.type === 'swiper'
        ? 'swiper'
        : widget.type === 'swiper-item'
          ? 'swiper-item'
          : widget.type === 'table'
            ? 'table'
            : widget.type === 'tr'
              ? 'tr'
              : widget.type === 'th'
                ? 'th'
                : widget.type === 'td'
                  ? 'td'
                  : parent;
  const childSource = widget.type === 'table' ? orderTableChildren(widget.children) : undefined;
  const children =
    widget.type === 'flex' ||
    widget.type === 'swiper' ||
    widget.type === 'swiper-item' ||
    widget.type === 'table' ||
    widget.type === 'tr' ||
    widget.type === 'th' ||
    widget.type === 'td'
      ? serializeWidgets(childSource ?? widget.children, ids, childParent)
      : [];
  return [...owned, ...overrides, ...children];
}

function extraDeclaredIds(extra: { states?: WidgetStateDelta[]; stateOverrides?: WidgetStateDelta[] }): string[] {
  return [
    ...(extra.states?.map((state) => state.id) ?? []),
    ...(extra.stateOverrides?.flatMap((item) => item.states?.map((state) => state.id) ?? []) ?? []),
  ];
}

function widgetStateSpread(
  widgetNode: OrderedNode,
  inner: OrderedNode[],
  ancestorIds: string[],
): Pick<WidgetStates, 'states' | 'stateOverrides' | 'stateFn' | 'hoverStateId' | 'transition'> & {
  rest: OrderedNode[];
} {
  const { states, overrides, rest } = splitStateNodes(inner);
  const known = new Set(ancestorIds);
  const stateOverrides = overrides
    .filter((item) => known.has(item.id))
    .map((item) => {
      const used = new Set(states.map((state) => state.id));
      const nested = (item.states ?? []).filter((state) => {
        if (used.has(state.id)) {
          return false;
        }
        used.add(state.id);
        return true;
      });
      const next: WidgetStateDelta = { ...item };
      if (nested.length > 0) {
        next.states = nested;
      } else {
        delete next.states;
      }
      delete next.appliedState;
      return next;
    });
  const ownedIds = [
    ...states.map((item) => item.id),
    ...stateOverrides.flatMap((item) => item.states?.map((state) => state.id) ?? []),
  ];
  const stateFn = parseHostStateFn(attr(widgetNode, 'state'), ownedIds);
  const hoverAttr = attr(widgetNode, 'hover');
  const hoverStateId = hoverAttr && ownedIds.includes(hoverAttr) ? hoverAttr : undefined;
  const transition = compactTransition(parseNonNegativeInteger(attr(widgetNode, 'transition')));
  return {
    rest,
    ...(states.length > 0 ? { states } : {}),
    ...(stateOverrides.length > 0 ? { stateOverrides } : {}),
    ...(stateFn ? { stateFn } : {}),
    ...(hoverStateId ? { hoverStateId } : {}),
    ...(transition ? { transition } : {}),
  };
}

function parseWidgets(
  nodes: OrderedNode[],
  ids: { n: number },
  parent: WidgetParent,
  ancestorIds: string[] = [],
): PageWidget[] {
  const widgets: PageWidget[] = [];
  const asItem = parent === 'flex';
  const allowSwiperItem = parent === 'swiper';
  const allowTableSection = parent === 'table';
  const allowTableCell = parent === 'tr';
  const allowContent = parent !== 'swiper' && parent !== 'table' && parent !== 'tr';

  for (const child of nodes) {
    if (allowContent && Object.prototype.hasOwnProperty.call(child, 'image')) {
      ids.n += 1;
      const style = parseStyle(child);
      const item = asItem ? parseItem(child) : undefined;
      const extra = widgetStateSpread(child, nodeList(child.image), ancestorIds);
      widgets.push({
        type: 'image',
        id: attr(child, 'id') || `n${ids.n}`,
        src: attr(child, 'src'),
        ...(style ? { style } : {}),
        ...(item ? { item } : {}),
        ...parseWidgetLoop(child),
        ...parseWidgetHidden(child),
        ...parseWidgetAlias(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.hoverStateId ? { hoverStateId: extra.hoverStateId } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowContent && Object.prototype.hasOwnProperty.call(child, 'icon')) {
      ids.n += 1;
      const style = parseStyle(child);
      const item = asItem ? parseItem(child) : undefined;
      const extra = widgetStateSpread(child, nodeList(child.icon), ancestorIds);
      const color = attr(child, 'color');
      const sizeStr = attr(child, 'size');
      const size = sizeStr ? Number(sizeStr) : undefined;
      const mergedStyle = color ? { ...(style ?? {}), color } : style;
      widgets.push({
        type: 'icon',
        id: attr(child, 'id') || `n${ids.n}`,
        src: attr(child, 'src'),
        ...(size != null && Number.isFinite(size) ? { size } : {}),
        ...(mergedStyle ? { style: mergedStyle } : {}),
        ...(item ? { item } : {}),
        ...parseWidgetLoop(child),
        ...parseWidgetHidden(child),
        ...parseWidgetAlias(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.hoverStateId ? { hoverStateId: extra.hoverStateId } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowContent && Object.prototype.hasOwnProperty.call(child, 'text')) {
      ids.n += 1;
      const style = parseStyle(child);
      const item = asItem ? parseItem(child) : undefined;
      const extra = widgetStateSpread(child, nodeList(child.text), ancestorIds);
      widgets.push({
        type: 'text',
        id: attr(child, 'id') || `n${ids.n}`,
        value: attr(child, 'value'),
        ...(style ? { style } : {}),
        ...(item ? { item } : {}),
        ...parseWidgetLoop(child),
        ...parseWidgetHidden(child),
        ...parseWidgetAlias(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.hoverStateId ? { hoverStateId: extra.hoverStateId } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowContent && Object.prototype.hasOwnProperty.call(child, 'button')) {
      ids.n += 1;
      const style = parseStyle(child);
      const item = asItem ? parseItem(child) : undefined;
      const extra = widgetStateSpread(child, nodeList(child.button), ancestorIds);
      widgets.push({
        type: 'button',
        id: attr(child, 'id') || `n${ids.n}`,
        text: attr(child, 'text'),
        ...(style ? { style } : {}),
        ...(item ? { item } : {}),
        ...parseWidgetLoop(child),
        ...parseWidgetHidden(child),
        ...parseWidgetAlias(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.hoverStateId ? { hoverStateId: extra.hoverStateId } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowContent && Object.prototype.hasOwnProperty.call(child, 'flex')) {
      ids.n += 1;
      const style = parseStyle(child);
      const flex = parseFlex(child);
      const item = asItem ? parseItem(child) : undefined;
      const extra = widgetStateSpread(child, nodeList(child.flex), ancestorIds);
      const nextIds = [...ancestorIds, ...extraDeclaredIds(extra)];
      widgets.push({
        type: 'flex',
        id: attr(child, 'id') || `n${ids.n}`,
        children: parseWidgets(extra.rest, ids, 'flex', nextIds),
        ...(style ? { style } : {}),
        ...(flex ? { flex } : {}),
        ...(item ? { item } : {}),
        ...parseWidgetLoop(child),
        ...parseWidgetHidden(child),
        ...parseWidgetAlias(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.hoverStateId ? { hoverStateId: extra.hoverStateId } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowContent && Object.prototype.hasOwnProperty.call(child, 'swiper')) {
      ids.n += 1;
      const style = sanitizeWidgetStyle('swiper', parseStyle(child));
      const swiper = parseSwiper(child);
      const item = asItem ? parseItem(child) : undefined;
      const extra = widgetStateSpread(child, nodeList(child.swiper), ancestorIds);
      const nextIds = [...ancestorIds, ...extraDeclaredIds(extra)];
      widgets.push({
        type: 'swiper',
        id: attr(child, 'id') || `n${ids.n}`,
        children: parseWidgets(extra.rest, ids, 'swiper', nextIds),
        ...(style ? { style } : {}),
        ...(swiper ? { swiper } : {}),
        ...(item ? { item } : {}),
        ...parseWidgetLoop(child),
        ...parseWidgetHidden(child),
        ...parseWidgetAlias(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.hoverStateId ? { hoverStateId: extra.hoverStateId } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowContent && Object.prototype.hasOwnProperty.call(child, 'table')) {
      ids.n += 1;
      const style = sanitizeWidgetStyle('table', parseStyle(child));
      const headerHeight = parseTableTrack(attr(child, 'header-height'), DEFAULT_TABLE_HEADER_HEIGHT);
      const freezeHeader = isTrue(attr(child, 'freeze-header')) || undefined;
      const freezeFooter = isTrue(attr(child, 'freeze-footer')) || undefined;
      const lines = parseTableLines(child);
      const item = asItem ? parseItem(child) : undefined;
      const extra = widgetStateSpread(child, nodeList(child.table), ancestorIds);
      const nextIds = [...ancestorIds, ...extraDeclaredIds(extra)];
      widgets.push({
        type: 'table',
        id: attr(child, 'id') || `n${ids.n}`,
        children: trimExtraCells(parseWidgets(extra.rest, ids, 'table', nextIds)),
        ...(style ? { style } : {}),
        ...(freezeHeader ? { freezeHeader } : {}),
        ...(freezeFooter ? { freezeFooter } : {}),
        ...(headerHeight != null ? { headerHeight } : {}),
        ...(lines ? { lines } : {}),
        ...(item ? { item } : {}),
        ...parseWidgetLoop(child),
        ...parseWidgetHidden(child),
        ...parseWidgetAlias(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.hoverStateId ? { hoverStateId: extra.hoverStateId } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowSwiperItem && Object.prototype.hasOwnProperty.call(child, 'swiper-item')) {
      ids.n += 1;
      const style = sanitizeWidgetStyle('swiper-item', parseStyle(child));
      const extra = widgetStateSpread(child, nodeList(child['swiper-item']), ancestorIds);
      const nextIds = [...ancestorIds, ...extraDeclaredIds(extra)];
      widgets.push({
        type: 'swiper-item',
        id: attr(child, 'id') || `n${ids.n}`,
        children: parseWidgets(extra.rest, ids, 'swiper-item', nextIds),
        ...(style ? { style } : {}),
        ...parseWidgetLoop(child),
        ...parseWidgetHidden(child),
        ...parseWidgetAlias(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.hoverStateId ? { hoverStateId: extra.hoverStateId } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowTableSection && Object.prototype.hasOwnProperty.call(child, 'th')) {
      ids.n += 1;
      const style = sanitizeWidgetStyle('th', parseStyle(child));
      const width = parseTableTrack(attr(child, 'width'), DEFAULT_TABLE_COLUMN_WIDTH);
      const align = parseEnum(attr(child, 'align'), TABLE_ALIGNS);
      const valign = parseEnum(attr(child, 'valign'), TABLE_VALIGNS);
      const storedAlign = align === 'start' ? undefined : align;
      const storedValign = valign === 'middle' ? undefined : valign;
      const extra = widgetStateSpread(child, nodeList(child.th), ancestorIds);
      const nextIds = [...ancestorIds, ...extraDeclaredIds(extra)];
      widgets.push({
        type: 'th',
        id: attr(child, 'id') || `n${ids.n}`,
        value: attr(child, 'value'),
        children: parseWidgets(extra.rest, ids, 'th', nextIds),
        ...(width != null ? { width } : {}),
        ...(storedAlign ? { align: storedAlign } : {}),
        ...(storedValign ? { valign: storedValign } : {}),
        ...(style ? { style } : {}),
        ...parseWidgetLoop(child),
        ...parseWidgetHidden(child),
        ...parseWidgetAlias(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.hoverStateId ? { hoverStateId: extra.hoverStateId } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowTableSection && Object.prototype.hasOwnProperty.call(child, 'tr')) {
      ids.n += 1;
      const style = sanitizeWidgetStyle('tr', parseStyle(child));
      const height = parseTableTrack(attr(child, 'height'), DEFAULT_TABLE_ROW_HEIGHT);
      const extra = widgetStateSpread(child, nodeList(child.tr), ancestorIds);
      const nextIds = [...ancestorIds, ...extraDeclaredIds(extra)];
      widgets.push({
        type: 'tr',
        id: attr(child, 'id') || `n${ids.n}`,
        children: parseWidgets(extra.rest, ids, 'tr', nextIds),
        ...(height != null ? { height } : {}),
        ...(style ? { style } : {}),
        ...parseWidgetLoop(child),
        ...parseWidgetHidden(child),
        ...parseWidgetAlias(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.hoverStateId ? { hoverStateId: extra.hoverStateId } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowTableCell && Object.prototype.hasOwnProperty.call(child, 'td')) {
      ids.n += 1;
      const style = sanitizeWidgetStyle('td', parseStyle(child));
      const align = parseEnum(attr(child, 'align'), TABLE_ALIGNS);
      const valign = parseEnum(attr(child, 'valign'), TABLE_VALIGNS);
      const storedAlign = align === 'start' ? undefined : align;
      const storedValign = valign === 'middle' ? undefined : valign;
      const extra = widgetStateSpread(child, nodeList(child.td), ancestorIds);
      const nextIds = [...ancestorIds, ...extraDeclaredIds(extra)];
      widgets.push({
        type: 'td',
        id: attr(child, 'id') || `n${ids.n}`,
        value: attr(child, 'value'),
        children: parseWidgets(extra.rest, ids, 'td', nextIds),
        ...(storedAlign ? { align: storedAlign } : {}),
        ...(storedValign ? { valign: storedValign } : {}),
        ...(style ? { style } : {}),
        ...parseWidgetLoop(child),
        ...parseWidgetHidden(child),
        ...parseWidgetAlias(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.hoverStateId ? { hoverStateId: extra.hoverStateId } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
    }
  }

  return widgets;
}

function widgetHostAttrs(
  widget: PageWidget,
  id: string,
  style: Record<string, string>,
  extra: Record<string, string>,
): Record<string, string> {
  const applied = compactStateFn(widget.stateFn);
  const hover = widget.hoverStateId;
  const hoverValid = hover && ownedStateIds(widget).includes(hover) ? hover : null;
  const transition = compactTransition(widget.transition);
  return {
    '@_id': id,
    ...style,
    ...extra,
    ...loopAttrs(widget.loop),
    ...(widget.hidden ? { '@_hidden': 'true' } : {}),
    ...(widget.alias?.trim() ? { '@_alias': widget.alias.trim() } : {}),
    ...(applied ? { '@_state': applied } : {}),
    ...(hoverValid ? { '@_hover': hoverValid } : {}),
    ...(transition ? { '@_transition': String(transition) } : {}),
  };
}

function serializeWidgets(widgets: PageWidget[], ids: { n: number }, parent: WidgetParent): OrderedNode[] {
  const asItem = parent === 'flex';
  return widgets.map((widget) => {
    ids.n += 1;
    const id = widget.id || `n${ids.n}`;
    const style = styleAttrs(sanitizeWidgetStyle(widget.type, widget.style));
    const item = asItem && hasFlexItem(widget) ? itemAttrs(widget.item) : {};
    const inner = serializeStateChildren(widget, ids, parent);
    if (widget.type === 'image') {
      return {
        image: inner,
        ':@': widgetHostAttrs(widget, id, style, { '@_src': widget.src, ...item }),
      };
    }
    if (widget.type === 'icon') {
      return {
        icon: inner,
        ':@': widgetHostAttrs(widget, id, style, {
          '@_src': widget.src,
          ...(widget.size != null ? { '@_size': String(widget.size) } : {}),
          ...item,
        }),
      };
    }
    if (widget.type === 'text') {
      return {
        text: inner,
        ':@': widgetHostAttrs(widget, id, style, { '@_value': widget.value, ...item }),
      };
    }
    if (widget.type === 'button') {
      return {
        button: inner,
        ':@': widgetHostAttrs(widget, id, style, { '@_text': widget.text, ...item }),
      };
    }
    if (widget.type === 'flex') {
      return {
        flex: inner,
        ':@': widgetHostAttrs(widget, id, style, { ...flexAttrs(widget.flex), ...item }),
      };
    }
    if (widget.type === 'swiper') {
      return {
        swiper: inner,
        ':@': widgetHostAttrs(widget, id, style, { ...swiperAttrs(widget.swiper), ...item }),
      };
    }
    if (widget.type === 'table') {
      return {
        table: inner,
        ':@': widgetHostAttrs(widget, id, style, {
          ...(widget.freezeHeader ? { '@_freeze-header': 'true' } : {}),
          ...(widget.freezeFooter ? { '@_freeze-footer': 'true' } : {}),
          ...tableTrackAttr('header-height', widget.headerHeight, DEFAULT_TABLE_HEADER_HEIGHT),
          ...tableLineAttrs(widget.lines),
          ...item,
        }),
      };
    }
    if (widget.type === 'th') {
      return {
        th: inner,
        ':@': widgetHostAttrs(widget, id, style, {
          '@_value': widget.value,
          ...tableTrackAttr('width', widget.width, DEFAULT_TABLE_COLUMN_WIDTH),
          ...cellAlignAttrs(widget.align, widget.valign),
        }),
      };
    }
    if (widget.type === 'tr') {
      return {
        tr: inner,
        ':@': widgetHostAttrs(widget, id, style, tableTrackAttr('height', widget.height, DEFAULT_TABLE_ROW_HEIGHT)),
      };
    }
    if (widget.type === 'td') {
      return {
        td: inner,
        ':@': widgetHostAttrs(widget, id, style, {
          '@_value': widget.value,
          ...cellAlignAttrs(widget.align, widget.valign),
        }),
      };
    }
    return {
      'swiper-item': inner,
      ':@': widgetHostAttrs(widget, id, style, {}),
    };
  });
}

export function parsePageXml(xml: string): PageXmlDocument {
  const result = XMLValidator.validate(xml);
  if (result !== true) {
    throw new XmlParseError(result.err.msg);
  }

  const pageNode = findPageRoot(pageParser.parse(xml));
  const style = parsePageStyle(pageNode);
  const { widgets, data } = splitPageChildren(nodeList(pageNode.page));
  return {
    widgets: parseWidgets(widgets, { n: 0 }, 'page'),
    ...(style ? { style } : {}),
    ...(data ? { data } : {}),
  };
}

export function serializePageXml(page: PageXmlDocument): string {
  const attrs = pageStyleAttrs(page.style);
  const children = [
    ...(page.data && page.data.length > 0 ? [serializePageData(page.data)] : []),
    ...serializeWidgets(page.widgets, { n: 0 }, 'page'),
  ];
  return pageBuilder.build([
    {
      '?xml': [],
      ':@': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    },
    {
      page: children,
      ...(Object.keys(attrs).length > 0 ? { ':@': attrs } : {}),
    },
  ]);
}

export const EMPTY_PAGE_XML = serializePageXml({ widgets: [] });

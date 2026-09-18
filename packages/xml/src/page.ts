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
  borderColor?: string;
  radiusTopLeft?: number;
  radiusTopRight?: number;
  radiusBottomRight?: number;
  radiusBottomLeft?: number;
  boxShadow?: string;
  width?: SizeValue;
  height?: SizeValue;
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

export type WidgetStateDelta = {
  name: string;
  transition?: number;
  appliedState?: string;
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

type WidgetCommon = WidgetStates & { loop?: WidgetLoop };

export type PageWidget =
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
    } & WidgetCommon);

type WidgetParent = 'page' | 'flex' | 'swiper' | 'swiper-item';

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

function parseHostStateFn(raw: string, ownedNames: string[]): string | undefined {
  const value = raw.trim();
  if (!value) {
    return undefined;
  }
  if (ownedNames.includes(value) && STATE_NAME_IDENT.test(value)) {
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
  'borderColor',
  'radiusTopLeft',
  'radiusTopRight',
  'radiusBottomRight',
  'radiusBottomLeft',
  'boxShadow',
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
    if (value == null || value === '' || value === false) {
      continue;
    }
    if (key === 'position' && !STORED_POSITIONS.includes(value as WidgetPosition)) {
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
    delete next.borderColor;
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
    next.width = compactSize(next.width) ?? DEFAULT_SWIPER_WIDTH;
    next.height = compactSize(next.height) ?? DEFAULT_SWIPER_HEIGHT;
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

function parseStyle(node: OrderedNode): WidgetStyle | undefined {
  const radius = parseNumber(attr(node, 'border-radius'));
  const margin = parseLengthEdges(attr(node, 'margin'), { allowAuto: true });
  const padding = parseLengthEdges(attr(node, 'padding'), { allowNegative: false, allowAuto: false });
  const border = parseEdges(attr(node, 'border-width'));
  const inset = parseLengthEdges(attr(node, 'inset'), { allowAuto: false });
  return compactWidgetStyle({
    color: attr(node, 'color') || undefined,
    textShadow: attr(node, 'text-shadow') || undefined,
    italic: isTrue(attr(node, 'italic')) || undefined,
    fontFamily: attr(node, 'font-family') || undefined,
    fontSize: parseNonNegative(attr(node, 'font-size')),
    fontWeight: attr(node, 'font-weight') || undefined,
    underline: isTrue(attr(node, 'underline')) || undefined,
    lineThrough: isTrue(attr(node, 'line-through')) || undefined,
    background: attr(node, 'background') || undefined,
    borderTopWidth: parseNonNegative(attr(node, 'border-top-width')) ?? border?.top,
    borderRightWidth: parseNonNegative(attr(node, 'border-right-width')) ?? border?.right,
    borderBottomWidth: parseNonNegative(attr(node, 'border-bottom-width')) ?? border?.bottom,
    borderLeftWidth: parseNonNegative(attr(node, 'border-left-width')) ?? border?.left,
    borderStyle: attr(node, 'border-style') || undefined,
    borderColor: attr(node, 'border-color') || undefined,
    radiusTopLeft: parseRadius(node, 'border-top-left-radius', radius),
    radiusTopRight: parseRadius(node, 'border-top-right-radius', radius),
    radiusBottomRight: parseRadius(node, 'border-bottom-right-radius', radius),
    radiusBottomLeft: parseRadius(node, 'border-bottom-left-radius', radius),
    boxShadow: attr(node, 'box-shadow') || undefined,
    width: parseSize(attr(node, 'width')),
    height: parseSize(attr(node, 'height')),
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
  writeBorderWidths(
    attrs,
    compact.borderTopWidth,
    compact.borderRightWidth,
    compact.borderBottomWidth,
    compact.borderLeftWidth,
  );
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
  style?: WidgetStyle;
  flex?: FlexContainerStyle;
  item?: FlexItemStyle;
  swiper?: SwiperStyle;
};

export function nestedOwnedStates(widget: PageWidget): WidgetStateDelta[] {
  return (widget.stateOverrides ?? []).flatMap((item) => item.states ?? []);
}

export function ownedStateNames(widget: PageWidget): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const state of [...(widget.states ?? []), ...nestedOwnedStates(widget)]) {
    if (seen.has(state.name)) {
      continue;
    }
    seen.add(state.name);
    names.push(state.name);
  }
  return names;
}

export function findOwnedDelta(widget: PageWidget, name: string): WidgetStateDelta | undefined {
  const owned = widget.states?.find((item) => item.name === name);
  if (owned) {
    return owned;
  }
  return nestedOwnedStates(widget).find((item) => item.name === name);
}

export function hasOwnedStates(widget: PageWidget): boolean {
  return Boolean(widget.states?.length || nestedOwnedStates(widget).length);
}

export function appliedStateName(widget: PageWidget): string | null {
  if (!widget.appliedState || !widget.states?.some((state) => state.name === widget.appliedState)) {
    return null;
  }
  return widget.appliedState;
}

export function nestedAppliedStateName(override: WidgetStateDelta | undefined): string | null {
  if (!override?.appliedState || !override.states?.some((state) => state.name === override.appliedState)) {
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

export type WidgetStateLayer = {
  name: string;
  role: WidgetStateRole;
};

export function resolveWidgetState(
  widget: PageWidget,
  stateName: string | null | undefined,
  role: WidgetStateRole,
): WidgetStateFields {
  return resolveWidgetStateStack(widget, stateName ? [{ name: stateName, role }] : []);
}

function widgetFieldBase(widget: PageWidget): WidgetStateFields {
  return {
    style: compactWidgetStyle(widget.style),
    flex: widget.type === 'flex' ? compactFlexContainer(widget.flex) : undefined,
    item: widget.type === 'swiper-item' ? undefined : compactFlexItem(widget.item),
    swiper: widget.type === 'swiper' ? compactSwiper(widget.swiper) : undefined,
  };
}

export function resolveWidgetStateStack(widget: PageWidget, layers: WidgetStateLayer[]): WidgetStateFields {
  let style = compactWidgetStyle(widget.style);
  let flex = widget.type === 'flex' ? compactFlexContainer(widget.flex) : undefined;
  let item = widget.type === 'swiper-item' ? undefined : compactFlexItem(widget.item);
  let swiper = widget.type === 'swiper' ? compactSwiper(widget.swiper) : undefined;
  let activeOverride: WidgetStateDelta | undefined;
  for (const layer of layers) {
    let delta: WidgetStateDelta | undefined;
    if (layer.role === 'owner') {
      delta = widget.states?.find((item) => item.name === layer.name) ?? activeOverride?.states?.find((item) => item.name === layer.name);
    } else {
      delta = widget.stateOverrides?.find((item) => item.name === layer.name);
      activeOverride = delta;
    }
    style = mergeStyle(style, delta?.style);
    flex = widget.type === 'flex' ? mergeFlex(flex, delta?.flex) : undefined;
    item = widget.type === 'swiper-item' ? undefined : mergeItem(item, delta?.item);
    swiper = widget.type === 'swiper' ? mergeSwiper(swiper, delta?.swiper) : undefined;
  }
  return { style, flex, item, swiper };
}

export function diffWidgetState(
  widget: PageWidget,
  next: WidgetStateFields,
  base?: WidgetStateFields,
): WidgetStateDelta | Pick<WidgetStateDelta, 'style' | 'flex' | 'item' | 'swiper'> {
  const origin = base ?? widgetFieldBase(widget);
  const style = diffRecord(origin.style, next.style, compactWidgetStyle);
  const flex = widget.type === 'flex' ? diffRecord(origin.flex, next.flex, compactFlexContainer) : undefined;
  const item = widget.type === 'swiper-item' ? undefined : diffRecord(origin.item, next.item, compactFlexItem);
  const swiper = widget.type === 'swiper' ? diffRecord(origin.swiper, next.swiper, compactSwiper) : undefined;
  return {
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

function stateTransition(widget: PageWidget, name: string | null | undefined): number | undefined {
  if (!name) {
    return compactTransition(widget.transition);
  }
  return compactTransition(findOwnedDelta(widget, name)?.transition);
}

function withResolvedFields(
  widget: PageWidget,
  fields: WidgetStateFields,
  transition?: number,
): PageWidget {
  const next = { ...widget } as PageWidget;
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
  if (next.type !== 'swiper-item') {
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
  appliedNameFor?: (widget: PageWidget) => string | null;
};

function ownerActiveName(
  widget: PageWidget,
  viewing: WidgetStateViewing[],
  appliedNameFor?: (widget: PageWidget) => string | null,
): string | null {
  const hit = viewing.find((item) => item.ownerId === widget.id);
  if (hit) {
    return hit.state;
  }
  if (appliedNameFor) {
    return appliedNameFor(widget);
  }
  return appliedStateName(widget);
}

function layerRole(widget: PageWidget, name: string): WidgetStateRole {
  return findOwnedDelta(widget, name) ? 'owner' : 'descendant';
}

function stackTransition(
  widget: PageWidget,
  layers: WidgetStateLayer[],
  inheritedTransition?: number,
): number | undefined {
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    if (layers[i].role === 'owner') {
      const duration = stateTransition(widget, layers[i].name);
      if (duration) {
        return duration;
      }
    }
  }
  return inheritedTransition;
}

function resolveWidgetNode(
  widget: PageWidget,
  inheritedNames: string[],
  viewing: WidgetStateViewing[],
  inheritedTransition: number | undefined,
  appliedNameFor?: (widget: PageWidget) => string | null,
): PageWidget {
  const ownName = ownerActiveName(widget, viewing, appliedNameFor);
  const layers: WidgetStateLayer[] = [];
  for (const name of inheritedNames) {
    const role = layerRole(widget, name);
    layers.push({ name, role });
  }
  if (ownName) {
    layers.push({ name: ownName, role: layerRole(widget, ownName) });
  }
  const transition =
    (ownName ? stateTransition(widget, ownName) : undefined) ??
    compactTransition(widget.transition) ??
    stackTransition(widget, layers, inheritedTransition);
  const next = withResolvedFields(widget, resolveWidgetStateStack(widget, layers), transition);
  if ('children' in next) {
    const childNames = ownName && !inheritedNames.includes(ownName) ? [...inheritedNames, ownName] : inheritedNames;
    const childTransition = transition;
    next.children = next.children.map((child) =>
      resolveWidgetNode(child, childNames, viewing, childTransition, appliedNameFor),
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
  return widgets.map((widget) => resolveWidgetNode(widget, [], list, undefined, options?.appliedNameFor));
}

function parseStateDelta(node: OrderedNode): WidgetStateDelta | undefined {
  const tag = Object.prototype.hasOwnProperty.call(node, '__') ? '__' : '_';
  const name = attr(node, 'name').trim();
  if (!name) {
    return undefined;
  }
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
      if (inner && !seen.has(inner.name)) {
        seen.add(inner.name);
        nested.push(inner);
      }
    }
  }
  return {
    name,
    ...(transition ? { transition } : {}),
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
      if (delta && !seen.has(delta.name)) {
        seen.add(delta.name);
        states.push(delta);
      }
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(node, '__')) {
      const delta = parseStateDelta(node);
      if (delta && !overrideSeen.has(delta.name)) {
        overrideSeen.add(delta.name);
        overrides.push(delta);
      }
      continue;
    }
    rest.push(node);
  }
  return { states, overrides, rest };
}

function compactDeltaForWrite(widget: PageWidget, delta: WidgetStateDelta, base?: WidgetStateFields): WidgetStateDelta {
  const origin = base ?? widgetFieldBase(widget);
  const resolved: WidgetStateFields = {
    style: compactWidgetStyle({ ...origin.style, ...delta.style }),
    flex: widget.type === 'flex' ? compactFlexContainer({ ...origin.flex, ...delta.flex }) : undefined,
    item: widget.type === 'swiper-item' ? undefined : compactFlexItem({ ...origin.item, ...delta.item }),
    swiper: widget.type === 'swiper' ? compactSwiper({ ...origin.swiper, ...delta.swiper }) : undefined,
  };
  return {
    name: delta.name,
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
    '@_name': compact.name,
    ...(tag === '_' && compact.transition != null ? { '@_transition': String(compact.transition) } : {}),
    ...styleAttrs(compact.style),
    ...(widget.type === 'flex' ? flexAttrs(compact.flex) : {}),
    ...(asItem && widget.type !== 'swiper-item' ? itemAttrs(compact.item) : {}),
    ...(widget.type === 'swiper' ? swiperAttrs(compact.swiper) : {}),
  };
  const nestedBase: WidgetStateFields = {
    style: compactWidgetStyle({ ...((base ?? widgetFieldBase(widget)).style ?? {}), ...(compact.style ?? {}) }),
    flex: widget.type === 'flex' ? compactFlexContainer({ ...((base ?? widgetFieldBase(widget)).flex ?? {}), ...(compact.flex ?? {}) }) : undefined,
    item:
      widget.type === 'swiper-item'
        ? undefined
        : compactFlexItem({ ...((base ?? widgetFieldBase(widget)).item ?? {}), ...(compact.item ?? {}) }),
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
  const used = new Set((widget.states ?? []).map((item) => item.name));
  return (widget.stateOverrides ?? []).map((item) => {
    const nested = (item.states ?? []).filter((state) => {
      if (used.has(state.name)) {
        return false;
      }
      used.add(state.name);
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
    widget.type === 'flex' ? 'flex' : widget.type === 'swiper' ? 'swiper' : widget.type === 'swiper-item' ? 'swiper-item' : parent;
  const children =
    widget.type === 'flex' || widget.type === 'swiper' || widget.type === 'swiper-item'
      ? serializeWidgets(widget.children, ids, childParent)
      : [];
  return [...owned, ...overrides, ...children];
}

function extraDeclaredNames(extra: { states?: WidgetStateDelta[]; stateOverrides?: WidgetStateDelta[] }): string[] {
  return [
    ...(extra.states?.map((state) => state.name) ?? []),
    ...(extra.stateOverrides?.flatMap((item) => item.states?.map((state) => state.name) ?? []) ?? []),
  ];
}

function widgetStateSpread(
  widgetNode: OrderedNode,
  inner: OrderedNode[],
  ancestorNames: string[],
): Pick<WidgetStates, 'states' | 'stateOverrides' | 'stateFn' | 'transition'> & { rest: OrderedNode[] } {
  const { states, overrides, rest } = splitStateNodes(inner);
  const known = new Set(ancestorNames);
  const used = new Set(states.map((item) => item.name));
  const stateOverrides = overrides
    .filter((item) => known.has(item.name))
    .map((item) => {
      const nested = (item.states ?? []).filter((state) => {
        if (used.has(state.name)) {
          return false;
        }
        used.add(state.name);
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
  const ownedNames = [
    ...states.map((item) => item.name),
    ...stateOverrides.flatMap((item) => item.states?.map((state) => state.name) ?? []),
  ];
  const stateFn = parseHostStateFn(attr(widgetNode, 'state'), ownedNames);
  const transition = compactTransition(parseNonNegativeInteger(attr(widgetNode, 'transition')));
  return {
    rest,
    ...(states.length > 0 ? { states } : {}),
    ...(stateOverrides.length > 0 ? { stateOverrides } : {}),
    ...(stateFn ? { stateFn } : {}),
    ...(transition ? { transition } : {}),
  };
}

function parseWidgets(
  nodes: OrderedNode[],
  ids: { n: number },
  parent: WidgetParent,
  ancestorNames: string[] = [],
): PageWidget[] {
  const widgets: PageWidget[] = [];
  const asItem = parent === 'flex';
  const allowSwiperItem = parent === 'swiper';
  const allowContent = parent !== 'swiper';

  for (const child of nodes) {
    if (allowContent && Object.prototype.hasOwnProperty.call(child, 'text')) {
      ids.n += 1;
      const style = parseStyle(child);
      const item = asItem ? parseItem(child) : undefined;
      const extra = widgetStateSpread(child, nodeList(child.text), ancestorNames);
      widgets.push({
        type: 'text',
        id: attr(child, 'id') || `n${ids.n}`,
        value: attr(child, 'value'),
        ...(style ? { style } : {}),
        ...(item ? { item } : {}),
        ...parseWidgetLoop(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowContent && Object.prototype.hasOwnProperty.call(child, 'button')) {
      ids.n += 1;
      const style = parseStyle(child);
      const item = asItem ? parseItem(child) : undefined;
      const extra = widgetStateSpread(child, nodeList(child.button), ancestorNames);
      widgets.push({
        type: 'button',
        id: attr(child, 'id') || `n${ids.n}`,
        text: attr(child, 'text'),
        ...(style ? { style } : {}),
        ...(item ? { item } : {}),
        ...parseWidgetLoop(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowContent && Object.prototype.hasOwnProperty.call(child, 'flex')) {
      ids.n += 1;
      const style = parseStyle(child);
      const flex = parseFlex(child);
      const item = asItem ? parseItem(child) : undefined;
      const extra = widgetStateSpread(child, nodeList(child.flex), ancestorNames);
      const nextNames = [...ancestorNames, ...extraDeclaredNames(extra)];
      widgets.push({
        type: 'flex',
        id: attr(child, 'id') || `n${ids.n}`,
        children: parseWidgets(extra.rest, ids, 'flex', nextNames),
        ...(style ? { style } : {}),
        ...(flex ? { flex } : {}),
        ...(item ? { item } : {}),
        ...parseWidgetLoop(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowContent && Object.prototype.hasOwnProperty.call(child, 'swiper')) {
      ids.n += 1;
      const style = sanitizeWidgetStyle('swiper', parseStyle(child));
      const swiper = parseSwiper(child);
      const item = asItem ? parseItem(child) : undefined;
      const extra = widgetStateSpread(child, nodeList(child.swiper), ancestorNames);
      const nextNames = [...ancestorNames, ...extraDeclaredNames(extra)];
      widgets.push({
        type: 'swiper',
        id: attr(child, 'id') || `n${ids.n}`,
        children: parseWidgets(extra.rest, ids, 'swiper', nextNames),
        ...(style ? { style } : {}),
        ...(swiper ? { swiper } : {}),
        ...(item ? { item } : {}),
        ...parseWidgetLoop(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowSwiperItem && Object.prototype.hasOwnProperty.call(child, 'swiper-item')) {
      ids.n += 1;
      const style = sanitizeWidgetStyle('swiper-item', parseStyle(child));
      const extra = widgetStateSpread(child, nodeList(child['swiper-item']), ancestorNames);
      const nextNames = [...ancestorNames, ...extraDeclaredNames(extra)];
      widgets.push({
        type: 'swiper-item',
        id: attr(child, 'id') || `n${ids.n}`,
        children: parseWidgets(extra.rest, ids, 'swiper-item', nextNames),
        ...(style ? { style } : {}),
        ...parseWidgetLoop(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
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
  const transition = compactTransition(widget.transition);
  return {
    '@_id': id,
    ...style,
    ...extra,
    ...loopAttrs(widget.loop),
    ...(applied ? { '@_state': applied } : {}),
    ...(transition ? { '@_transition': String(transition) } : {}),
  };
}

function serializeWidgets(widgets: PageWidget[], ids: { n: number }, parent: WidgetParent): OrderedNode[] {
  const asItem = parent === 'flex';
  return widgets.map((widget) => {
    ids.n += 1;
    const id = widget.id || `n${ids.n}`;
    const style = styleAttrs(sanitizeWidgetStyle(widget.type, widget.style));
    const item = asItem && widget.type !== 'swiper-item' ? itemAttrs(widget.item) : {};
    const inner = serializeStateChildren(widget, ids, parent);
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

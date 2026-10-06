import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { resolvePageData } from './data';
import { compactPageEvents, compactWidgetEvents, isWidgetEventId, PAGE_EVENT_SPECS, widgetEventSpecs, type WidgetEvents } from './events';
import {
  isPageMethodId,
  isPageMethodName,
  isPageMethodParamName,
  isPageMethodParamType,
  type PageMethod,
  type PageMethodParam,
} from './methods';
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
  italic?: boolean | string;
  fontFamily?: string;
  fontSize?: number | string;
  fontWeight?: string;
  underline?: boolean | string;
  lineThrough?: boolean | string;
  background?: string;
  borderTopWidth?: number | string;
  borderRightWidth?: number | string;
  borderBottomWidth?: number | string;
  borderLeftWidth?: number | string;
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
  radiusTopLeft?: number | string;
  radiusTopRight?: number | string;
  radiusBottomRight?: number | string;
  radiusBottomLeft?: number | string;
  boxShadow?: string;
  width?: SizeValue | string;
  height?: SizeValue | string;
  overflow?: OverflowMode | string;
  position?: WidgetPosition | string;
  zIndex?: number | string;
  top?: BoxLength | string;
  right?: BoxLength | string;
  bottom?: BoxLength | string;
  left?: BoxLength | string;
  marginTop?: BoxLength | string;
  marginRight?: BoxLength | string;
  marginBottom?: BoxLength | string;
  marginLeft?: BoxLength | string;
  paddingTop?: BoxLength | string;
  paddingRight?: BoxLength | string;
  paddingBottom?: BoxLength | string;
  paddingLeft?: BoxLength | string;
  rotateX?: AngleValue | string;
  rotateY?: AngleValue | string;
  rotateZ?: AngleValue | string;
  transition?: number | string;
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
  display?: FlexDisplay | string;
  flexDirection?: FlexDirection | string;
  flexWrap?: FlexWrap | string;
  justifyContent?: FlexJustifyContent | string;
  alignItems?: FlexAlignItems | string;
  alignContent?: FlexAlignContent | string;
  rowGap?: number | string;
  columnGap?: number | string;
};

export type FlexItemStyle = {
  order?: number | string;
  flexGrow?: number | string;
  flexShrink?: number | string;
  flexBasis?: 'auto' | number | string;
  alignSelf?: FlexAlignSelf | string;
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
  indicatorDots?: boolean | string;
  indicatorColor?: string;
  indicatorActiveColor?: string;
  autoplay?: boolean | string;
  current?: number | string;
  interval?: number | string;
  duration?: number | string;
  circular?: boolean | string;
  vertical?: boolean | string;
  previousMargin?: number | string;
  nextMargin?: number | string;
  displayMultipleItems?: number | string;
  snapToEdge?: boolean | string;
  easingFunction?: SwiperEasing | string;
};

export const TABLE_ALIGNS = ['start', 'center', 'end'] as const;
export type TableAlign = (typeof TABLE_ALIGNS)[number];
export const TABLE_VALIGNS = ['top', 'middle', 'bottom'] as const;
export type TableValign = (typeof TABLE_VALIGNS)[number];
export const INPUT_TYPES = ['text', 'password', 'textarea', 'number'] as const;
export type InputType = (typeof INPUT_TYPES)[number];

export function inputModelDataType(inputType: string | undefined): 'str' | 'num' {
  return inputType === 'number' ? 'num' : 'str';
}

const PROP_MODEL = /^\$props\.([\p{ID_Start}$_][\p{ID_Continue}$]*)$/u;

/** 控件双向绑定到组件入参时，`modelValue` 存成 `$props.参数名`。 */
export function propModelName(raw: string | undefined): string | null {
  const match = PROP_MODEL.exec((raw ?? '').trim());
  return match ? match[1] : null;
}

export function normalizeInputModelValue(inputType: string | undefined, raw: string): string | null {
  if (inputModelDataType(inputType) === 'str') {
    return raw;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return '0';
  }
  return Number.isFinite(Number(trimmed)) ? trimmed : null;
}

export function inputBoundText(
  widget: { inputType?: string; modelValue?: string },
  variables: PageVariable[] | undefined,
  overrides?: Readonly<Record<string, string>>,
): string | null {
  const name = widget.modelValue?.trim();
  if (!name) {
    return null;
  }
  const variable = variables?.find((item) => item.name === name && item.type === inputModelDataType(widget.inputType));
  if (!variable) {
    return '';
  }
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, name)) {
    return overrides[name];
  }
  return variable.value;
}

/** Values in the bound array. Null when `selected` is unset. */
export function checkboxBoundSelected(
  widget: { selected?: string },
  variables: PageVariable[] | undefined,
  overrides?: Readonly<Record<string, string>>,
): unknown[] | null {
  const name = widget.selected?.trim();
  if (!name) {
    return null;
  }
  const variable = variables?.find((item) => item.name === name && item.type === 'arr');
  if (!variable) {
    return [];
  }
  const value = resolvePageData(variables, overrides)[name];
  if (!Array.isArray(value)) {
    return [];
  }
  return value;
}

/** Bound on/off state for a switch. Null when `modelValue` is unset. */
export function switchBoundOn(
  widget: { modelValue?: string },
  variables: PageVariable[] | undefined,
  overrides?: Readonly<Record<string, string>>,
): boolean | null {
  const name = widget.modelValue?.trim();
  if (!name) {
    return null;
  }
  const variable = variables?.find((item) => item.name === name && item.type === 'bool');
  if (!variable) {
    return false;
  }
  const raw =
    overrides && Object.prototype.hasOwnProperty.call(overrides, name) ? overrides[name] : variable.value;
  return raw === '1' || raw === 'true';
}

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
  transition?: number | string;
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
  transition?: number | string;
};

export const LOOP_FROMS = ['data', 'props', 'literal'] as const;
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

type WidgetCommon = WidgetStates & {
  loop?: WidgetLoop;
  hidden?: boolean;
  alias?: string;
  events?: WidgetEvents;
};

export type PageWidget =
  | ({ type: 'image'; id: string; src: string; style?: WidgetStyle; item?: FlexItemStyle } & WidgetCommon)
  | ({ type: 'icon'; id: string; src: string; size?: number | string; style?: WidgetStyle; item?: FlexItemStyle } & WidgetCommon)
  | ({ type: 'text'; id: string; value: string; style?: WidgetStyle; item?: FlexItemStyle } & WidgetCommon)
  | ({
      type: 'component';
      id: string;
      componentId: string;
      componentKey: string;
      name: string;
      /** 页面上传给这个组件实例的入参。键是入参名，值是字面量或 `$data` / `$()` 绑定。 */
      args?: Record<string, string>;
      style?: WidgetStyle;
      item?: FlexItemStyle;
    } & WidgetCommon)
  | ({ type: 'button'; id: string; text: string; style?: WidgetStyle; item?: FlexItemStyle } & WidgetCommon)
  | ({
      type: 'input';
      id: string;
      value: string;
      inputType?: InputType | string;
      modelValue?: string;
      placeholder?: string;
      style?: WidgetStyle;
      item?: FlexItemStyle;
    } & WidgetCommon)
  | ({
      type: 'checkbox';
      id: string;
      text: string;
      value: string;
      checked?: boolean | string;
      selected?: string;
      style?: WidgetStyle;
      item?: FlexItemStyle;
    } & WidgetCommon)
  | ({
      type: 'switch';
      id: string;
      value: boolean | string;
      modelValue?: string;
      style?: WidgetStyle;
      item?: FlexItemStyle;
    } & WidgetCommon)
  | ({
      type: 'flex';
      id: string;
      children: PageWidget[];
      style?: WidgetStyle;
      flex?: FlexContainerStyle;
      item?: FlexItemStyle;
    } & WidgetCommon)
  | ({
      type: 'scroll';
      id: string;
      children: PageWidget[];
      style?: WidgetStyle;
      /** 缺省为开。关掉后这一轴裁切，不滚动。 */
      scrollX?: boolean;
      scrollY?: boolean;
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

type WidgetParent = 'page' | 'flex' | 'scroll' | 'swiper' | 'swiper-item' | 'table' | 'tr' | 'th' | 'td';

function hasFlexItem(
  widget: PageWidget,
): widget is Exclude<PageWidget, { type: 'swiper-item' | 'th' | 'tr' | 'td' }> {
  return widget.type !== 'swiper-item' && widget.type !== 'th' && widget.type !== 'tr' && widget.type !== 'td';
}

export type PageStyle = {
  background?: string;
  paddingTop?: number | string;
  paddingRight?: number | string;
  paddingBottom?: number | string;
  paddingLeft?: number | string;
  /** 预览与 H5 的屏幕溢出。缺省为 auto，不写入 XML。编辑画布始终可见。 */
  overflow?: OverflowMode | string;
};

export const PAGE_DATA_TYPES = ['num', 'str', 'bool', 'arr', 'obj', 'icon', 'image', 'widget'] as const;
export type PageDataType = (typeof PAGE_DATA_TYPES)[number];

export type PageVariable = {
  type: PageDataType;
  name: string;
  value: string;
  desc?: string;
  watch?: string;
  /**
   * 数组的元素类型，或对象引用的命名空间类型名。
   * 内置元素类型是 num、str、bool、obj、icon、image、widget，其余是命名空间里的类型名。
   */
  of?: string;
  /** 数组或对象用函数表达式生成值。缺省按静态字面量编辑。 */
  dynamic?: boolean;
  /** 动态值打开后按表达式跟随 `$data` / `$props`，关闭后只在创建时求值一次。 */
  computed?: boolean;
};

export const COMPONENT_PROP_TYPES = ['num', 'str', 'bool', 'arr', 'obj', 'icon', 'image'] as const;
export type ComponentPropType = (typeof COMPONENT_PROP_TYPES)[number];

export type ComponentProp = {
  name: string;
  type: ComponentPropType;
  value: string;
  desc?: string;
  required?: boolean;
  /** 双向绑定时，外部可以把这个入参写成可写绑定。脚本里用 `$props.参数名` 读取。 */
  bind?: boolean;
  /** 数组的元素类型，或对象引用的命名空间类型名。 */
  of?: string;
};

/** 调试样本。键是入参、页面 query 或变量名，值的写法和定义里的 value 相同。缺省时用定义值。 */
export type PageTestData = {
  props?: Record<string, string>;
  query?: Record<string, string>;
  data?: Record<string, string>;
};

export function compactPageTestData(
  input: PageTestData | undefined,
  props: ComponentProp[] | undefined,
  data: PageVariable[] | undefined,
  query?: ComponentProp[],
): PageTestData | undefined {
  const propNames = new Set((props ?? []).map((item) => item.name));
  const dataNames = new Set((data ?? []).map((item) => item.name));
  const queryNames = new Set((query ?? []).map((item) => item.name));
  const nextProps = pickTestBag(input?.props, propNames);
  const nextData = pickTestBag(input?.data, dataNames);
  const nextQuery = pickTestBag(input?.query, queryNames);
  if (!nextProps && !nextData && !nextQuery) {
    return undefined;
  }
  return {
    ...(nextProps ? { props: nextProps } : {}),
    ...(nextQuery ? { query: nextQuery } : {}),
    ...(nextData ? { data: nextData } : {}),
  };
}

function pickTestBag(
  bag: Record<string, string> | undefined,
  names: Set<string>,
): Record<string, string> | undefined {
  if (!bag) {
    return undefined;
  }
  const next: Record<string, string> = {};
  for (const [name, value] of Object.entries(bag)) {
    if (!isJsIdentifier(name) || !names.has(name) || typeof value !== 'string') {
      continue;
    }
    next[name] = value;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export type ComponentEmit = {
  name: string;
  desc?: string;
  params: PageMethodParam[];
};

export function isComponentPropType(value: string): value is ComponentPropType {
  return (COMPONENT_PROP_TYPES as readonly string[]).includes(value);
}

export function compactComponentArgs(
  args: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!args) {
    return undefined;
  }
  const next: Record<string, string> = {};
  for (const [name, value] of Object.entries(args)) {
    const trimmed = value.trim();
    if (!isJsIdentifier(name) || !trimmed) {
      continue;
    }
    next[name] = trimmed;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

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
  events?: WidgetEvents;
  methods?: PageMethod[];
  props?: ComponentProp[];
  /** 页面 query。预览和运行时用 `$query.参数名` 读取，缺省时用这里的值。 */
  query?: ComponentProp[];
  emits?: ComponentEmit[];
  testData?: PageTestData;
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

const WIDGET_TAGS = [
  'image',
  'icon',
  'text',
  'component',
  'button',
  'input',
  'checkbox',
  'switch',
  'flex',
  'scroll',
  'swiper',
  'swiper-item',
  'table',
  'th',
  'tr',
  'td',
] as const;

function parseWidgetEvents(node: OrderedNode): { events?: WidgetEvents } {
  const type = WIDGET_TAGS.find((tag) => Object.prototype.hasOwnProperty.call(node, tag));
  if (!type) {
    return {};
  }
  const raw: WidgetEvents = {};
  for (const item of widgetEventSpecs(type)) {
    const ids = attr(node, `@${item.name}`)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length > 0) {
      raw[item.name] = ids;
    }
  }
  const order = attr(node, '@event-order')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (order.length > 0) {
    raw.order = order;
  }
  const events = compactWidgetEvents(type, raw);
  return events ? { events } : {};
}

function widgetEventAttrs(type: (typeof WIDGET_TAGS)[number], events: WidgetEvents | undefined): Record<string, string> {
  const compact = compactWidgetEvents(type, events);
  if (!compact) {
    return {};
  }
  const attrs: Record<string, string> = {};
  for (const [name, ids] of Object.entries(compact)) {
    if (name === 'order' || !ids?.length) {
      continue;
    }
    attrs[`@_@${name}`] = ids.join(',');
  }
  if (compact.order?.length) {
    attrs['@_@event-order'] = compact.order.join(',');
  }
  return attrs;
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

const STORED_BINDING_EXPR = /^\s*\$\(([\s\S]*)\)\s*$/;
const STORED_BINDING_PATH =
  /^\s*\$([\p{ID_Start}$_][\p{ID_Continue}$]*)((?:\.[\p{ID_Start}$_][\p{ID_Continue}$]*)*)\s*$/u;

function storedBinding(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed || (!STORED_BINDING_EXPR.test(trimmed) && !STORED_BINDING_PATH.test(trimmed))) {
    return undefined;
  }
  return trimmed;
}

function parseBoolAttr(value: string | undefined): boolean | string | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  return storedBinding(value) ?? isTrue(value);
}

function parseNumber(value: string): number | string | undefined {
  if (!value) {
    return undefined;
  }
  const bound = storedBinding(value);
  if (bound) {
    return bound;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asNumber(value: number | string | undefined): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function parseNonNegative(value: string): number | string | undefined {
  const bound = storedBinding(value);
  if (bound) {
    return bound;
  }
  const parsed = parseNumber(value);
  return typeof parsed === 'number' && parsed >= 0 ? parsed : undefined;
}

function parseInteger(value: string): number | string | undefined {
  if (!value) {
    return undefined;
  }
  const bound = storedBinding(value);
  if (bound) {
    return bound;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseNonNegativeInteger(value: string): number | string | undefined {
  const bound = storedBinding(value);
  if (bound) {
    return bound;
  }
  const parsed = parseInteger(value);
  return typeof parsed === 'number' && parsed >= 0 ? parsed : undefined;
}

function parsePositiveInteger(value: string): number | string | undefined {
  const bound = storedBinding(value);
  if (bound) {
    return bound;
  }
  const parsed = parseInteger(value);
  return typeof parsed === 'number' && parsed > 0 ? parsed : undefined;
}

function parseEnum<T extends string>(value: string, allowed: readonly T[]): T | undefined {
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function parseBoundEnum<T extends string>(value: string, allowed: readonly T[]): T | string | undefined {
  return storedBinding(value) ?? parseEnum(value, allowed);
}

function parseRadius(node: OrderedNode, name: string, fallback?: number | string): number | string | undefined {
  const parsed = parseNumber(attr(node, name));
  if (typeof parsed === 'string') {
    return parsed;
  }
  return parsed ?? fallback;
}

export function parseSize(raw: string): SizeValue | string | undefined {
  const bound = storedBinding(raw);
  if (bound) {
    return bound;
  }
  const value = raw.trim().toLowerCase();
  if (!value || value === 'fit-content' || value === 'auto') {
    return undefined;
  }
  if (value.endsWith('%')) {
    const parsed = parseNonNegative(value.slice(0, -1));
    return typeof parsed === 'number' ? { mode: '%', value: parsed } : undefined;
  }
  const parsed = parseNonNegative(value.endsWith('px') ? value.slice(0, -2) : value);
  return typeof parsed === 'number' ? { mode: 'px', value: parsed } : undefined;
}

function formatSize(size: SizeValue | string): string {
  if (typeof size === 'string') {
    return size;
  }
  return size.mode === '%' ? `${size.value}%` : String(size.value);
}

export function parseBoxLength(
  raw: string,
  options?: { allowNegative?: boolean; allowAuto?: boolean },
): BoxLength | string | undefined {
  const bound = storedBinding(raw);
  if (bound) {
    return bound;
  }
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
    if (typeof parsed !== 'number' || (!allowNegative && parsed < 0)) {
      return undefined;
    }
    return { mode: '%', value: parsed };
  }
  const parsed = parseNumber(value.endsWith('px') ? value.slice(0, -2) : value);
  if (typeof parsed !== 'number' || (!allowNegative && parsed < 0)) {
    return undefined;
  }
  return { mode: 'px', value: parsed };
}

export function formatBoxLength(length: BoxLength | string): string {
  if (typeof length === 'string') {
    return length;
  }
  if (length.mode === 'auto') {
    return 'auto';
  }
  if (length.mode === '%') {
    return `${length.value}%`;
  }
  return String(length.value);
}

export function boxLengthCss(length: BoxLength | string): string {
  if (typeof length === 'string') {
    return length;
  }
  if (length.mode === 'px') {
    return `${length.value}px`;
  }
  return formatBoxLength(length);
}

export function parseAngle(raw: string): AngleValue | string | undefined {
  const bound = storedBinding(raw);
  if (bound) {
    return bound;
  }
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

export function formatAngle(angle: AngleValue | string): string {
  if (typeof angle === 'string') {
    return angle;
  }
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

export function compactAngle(value: unknown): AngleValue | string | undefined {
  if (typeof value === 'string') {
    return storedBinding(value);
  }
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

export function boxLengthsEqual(a?: BoxLength | string, b?: BoxLength | string) {
  if (typeof a === 'string' || typeof b === 'string') {
    return a === b;
  }
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
): BoxLength | string | undefined {
  if (typeof value === 'string') {
    return storedBinding(value);
  }
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
  top?: BoxLength | string,
  right?: BoxLength | string,
  bottom?: BoxLength | string,
  left?: BoxLength | string,
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
  top?: BoxLength | string,
  right?: BoxLength | string,
  bottom?: BoxLength | string,
  left?: BoxLength | string,
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
  top?: number | string,
  right?: number | string,
  bottom?: number | string,
  left?: number | string,
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
    if (typeof value === 'string' && storedBinding(value)) {
      (next as Record<string, unknown>)[key] = value.trim();
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
export const DEFAULT_SCROLL_WIDTH: SizeValue = { mode: '%', value: 100 };
export const DEFAULT_SCROLL_HEIGHT: SizeValue = { mode: 'px', value: 200 };

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
    next.width = compactSize(next.width) ?? DEFAULT_SWIPER_WIDTH;
    next.height = compactSize(next.height) ?? DEFAULT_SWIPER_HEIGHT;
  }
  if (type !== 'table') {
    delete next.overflow;
  }
  if (type === 'scroll') {
    next.width = fixedWidgetSize(next.width, DEFAULT_SCROLL_WIDTH);
    next.height = fixedWidgetSize(next.height, DEFAULT_SCROLL_HEIGHT);
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

/** 滚动容器只要 px 或 %。绑定和自适应都落回默认尺寸。 */
export function fixedWidgetSize(size: SizeValue | string | undefined, fallback: SizeValue): SizeValue {
  const compact = compactSize(size);
  if (compact && typeof compact !== 'string') {
    return compact;
  }
  return fallback;
}

export function compactSize(size: SizeValue | string | undefined): SizeValue | string | undefined {
  if (typeof size === 'string') {
    return storedBinding(size);
  }
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
  'overflow',
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
    if (typeof value === 'string' && storedBinding(value)) {
      (next as Record<string, unknown>)[key] = value.trim();
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
    if (key === 'overflow') {
      if (value === 'auto' || !(OVERFLOW_MODES as readonly string[]).includes(value as string)) {
        continue;
      }
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
  if (typeof style.rowGap === 'string' && storedBinding(style.rowGap)) {
    next.rowGap = style.rowGap.trim();
  } else if (typeof style.rowGap === 'number' && style.rowGap >= 0) {
    next.rowGap = style.rowGap;
  }
  if (typeof style.columnGap === 'string' && storedBinding(style.columnGap)) {
    next.columnGap = style.columnGap.trim();
  } else if (typeof style.columnGap === 'number' && style.columnGap >= 0) {
    next.columnGap = style.columnGap;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

export function compactFlexItem(style: FlexItemStyle | undefined): FlexItemStyle | undefined {
  if (!style) {
    return undefined;
  }

  const next: FlexItemStyle = {};
  if (typeof style.order === 'string' && storedBinding(style.order)) {
    next.order = style.order.trim();
  } else if (typeof style.order === 'number' && Number.isFinite(style.order)) {
    next.order = style.order;
  }
  if (typeof style.flexGrow === 'string' && storedBinding(style.flexGrow)) {
    next.flexGrow = style.flexGrow.trim();
  } else if (typeof style.flexGrow === 'number' && Number.isFinite(style.flexGrow) && style.flexGrow >= 0) {
    next.flexGrow = style.flexGrow;
  }
  if (typeof style.flexShrink === 'string' && storedBinding(style.flexShrink)) {
    next.flexShrink = style.flexShrink.trim();
  } else if (typeof style.flexShrink === 'number' && Number.isFinite(style.flexShrink) && style.flexShrink >= 0) {
    next.flexShrink = style.flexShrink;
  }
  if (typeof style.flexBasis === 'string' && storedBinding(style.flexBasis)) {
    next.flexBasis = style.flexBasis.trim();
  } else if (style.flexBasis === 'auto') {
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
  const keepBool = (value: boolean | string | undefined) =>
    typeof value === 'string' && storedBinding(value) ? value.trim() : value ? true : undefined;
  const keepNum = (value: number | string | undefined, ok: (num: number) => boolean) => {
    if (typeof value === 'string' && storedBinding(value)) {
      return value.trim();
    }
    return typeof value === 'number' && ok(value) ? value : undefined;
  };
  const dots = keepBool(style.indicatorDots);
  if (dots) {
    next.indicatorDots = dots;
  }
  if (style.indicatorColor) {
    next.indicatorColor = style.indicatorColor;
  }
  if (style.indicatorActiveColor) {
    next.indicatorActiveColor = style.indicatorActiveColor;
  }
  const autoplay = keepBool(style.autoplay);
  if (autoplay) {
    next.autoplay = autoplay;
  }
  const current = keepNum(style.current, (num) => Number.isInteger(num) && num >= 0);
  if (current != null) {
    next.current = current;
  }
  const interval = keepNum(style.interval, (num) => Number.isInteger(num) && num > 0);
  if (interval != null) {
    next.interval = interval;
  }
  const duration = keepNum(style.duration, (num) => Number.isInteger(num) && num >= 0);
  if (duration != null) {
    next.duration = duration;
  }
  const circular = keepBool(style.circular);
  if (circular) {
    next.circular = circular;
  }
  const vertical = keepBool(style.vertical);
  if (vertical) {
    next.vertical = vertical;
  }
  const previousMargin = keepNum(style.previousMargin, (num) => Number.isFinite(num) && num >= 0);
  if (previousMargin != null) {
    next.previousMargin = previousMargin;
  }
  const nextMargin = keepNum(style.nextMargin, (num) => Number.isFinite(num) && num >= 0);
  if (nextMargin != null) {
    next.nextMargin = nextMargin;
  }
  const displayMultipleItems = keepNum(
    style.displayMultipleItems,
    (num) => Number.isInteger(num) && num >= 1,
  );
  if (displayMultipleItems != null) {
    next.displayMultipleItems = displayMultipleItems;
  }
  const snapToEdge = keepBool(style.snapToEdge);
  if (snapToEdge) {
    next.snapToEdge = snapToEdge;
  }
  if (typeof style.easingFunction === 'string' && storedBinding(style.easingFunction)) {
    next.easingFunction = style.easingFunction.trim();
  } else if (style.easingFunction) {
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
    overflow: parseBoundEnum(attr(node, 'overflow'), OVERFLOW_MODES),
    position: parseBoundEnum(attr(node, 'position'), STORED_POSITIONS),
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
    display: parseBoundEnum(attr(node, 'display'), FLEX_DISPLAYS),
    flexDirection: parseBoundEnum(attr(node, 'flex-direction'), FLEX_DIRECTIONS),
    flexWrap: parseBoundEnum(attr(node, 'flex-wrap'), FLEX_WRAPS),
    justifyContent: parseBoundEnum(attr(node, 'justify-content'), FLEX_JUSTIFY_CONTENTS),
    alignItems: parseBoundEnum(attr(node, 'align-items'), FLEX_ALIGN_ITEMS),
    alignContent: parseBoundEnum(attr(node, 'align-content'), FLEX_ALIGN_CONTENTS),
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
    alignSelf: parseBoundEnum(attr(node, 'align-self'), FLEX_ALIGN_SELFS),
  });
}

function parseTableTrack(raw: string, omitDefault: number): number | undefined {
  const parsed = parseNonNegative(raw);
  if (typeof parsed !== 'number') {
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
      width: asNumber(parseNonNegativeInteger(attr(node, `${kind}-line-width`))),
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
    indicatorDots: parseBoolAttr(attr(node, 'indicator-dots')),
    indicatorColor: attr(node, 'indicator-color') || undefined,
    indicatorActiveColor: attr(node, 'indicator-active-color') || undefined,
    autoplay: parseBoolAttr(attr(node, 'autoplay')),
    current: parseNonNegativeInteger(attr(node, 'current')),
    interval: parsePositiveInteger(attr(node, 'interval')),
    duration: parseNonNegativeInteger(attr(node, 'duration')),
    circular: parseBoolAttr(attr(node, 'circular')),
    vertical: parseBoolAttr(attr(node, 'vertical')),
    previousMargin: parseNonNegative(attr(node, 'previous-margin')),
    nextMargin: parseNonNegative(attr(node, 'next-margin')),
    displayMultipleItems: parsePositiveInteger(attr(node, 'display-multiple-items')),
    snapToEdge: parseBoolAttr(attr(node, 'snap-to-edge')),
    easingFunction: parseBoundEnum(attr(node, 'easing-function'), SWIPER_EASINGS),
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
  if (typeof compact.italic === 'string') {
    attrs['@_italic'] = compact.italic;
  } else if (compact.italic != null) {
    attrs['@_italic'] = compact.italic ? 'true' : 'false';
  }
  if (typeof compact.underline === 'string') {
    attrs['@_underline'] = compact.underline;
  } else if (compact.underline != null) {
    attrs['@_underline'] = compact.underline ? 'true' : 'false';
  }
  if (typeof compact.lineThrough === 'string') {
    attrs['@_line-through'] = compact.lineThrough;
  } else if (compact.lineThrough != null) {
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
  if (typeof compact.indicatorDots === 'string') {
    attrs['@_indicator-dots'] = compact.indicatorDots;
  } else if (compact.indicatorDots) {
    attrs['@_indicator-dots'] = 'true';
  }
  if (compact.indicatorColor) {
    attrs['@_indicator-color'] = compact.indicatorColor;
  }
  if (compact.indicatorActiveColor) {
    attrs['@_indicator-active-color'] = compact.indicatorActiveColor;
  }
  if (typeof compact.autoplay === 'string') {
    attrs['@_autoplay'] = compact.autoplay;
  } else if (compact.autoplay) {
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
  if (typeof compact.circular === 'string') {
    attrs['@_circular'] = compact.circular;
  } else if (compact.circular) {
    attrs['@_circular'] = 'true';
  }
  if (typeof compact.vertical === 'string') {
    attrs['@_vertical'] = compact.vertical;
  } else if (compact.vertical) {
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
  if (typeof compact.snapToEdge === 'string') {
    attrs['@_snap-to-edge'] = compact.snapToEdge;
  } else if (compact.snapToEdge) {
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

function pageEventAttrs(events: WidgetEvents | undefined): Record<string, string> {
  const compact = compactPageEvents(events);
  if (!compact) {
    return {};
  }
  const attrs: Record<string, string> = {};
  for (const item of PAGE_EVENT_SPECS) {
    const ids = compact[item.name];
    if (ids && ids.length > 0) {
      attrs[`@_@${item.name}`] = ids.join(',');
    }
  }
  if (compact.order && compact.order.length > 0) {
    attrs['@_@event-order'] = compact.order.join(',');
  }
  return attrs;
}

function parsePageEvents(node: OrderedNode): WidgetEvents | undefined {
  const raw: WidgetEvents = {};
  for (const item of PAGE_EVENT_SPECS) {
    const ids = attr(node, `@${item.name}`)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length > 0) {
      raw[item.name] = ids;
    }
  }
  const order = attr(node, '@event-order')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (order.length > 0) {
    raw.order = order;
  }
  return compactPageEvents(raw);
}

function parsePageStyle(node: OrderedNode): PageStyle | undefined {
  const padding = parseEdges(attr(node, 'padding'));
  return compactPageStyle({
    background: attr(node, 'background') || undefined,
    paddingTop: parseNonNegative(attr(node, 'padding-top')) ?? padding?.top,
    paddingRight: parseNonNegative(attr(node, 'padding-right')) ?? padding?.right,
    paddingBottom: parseNonNegative(attr(node, 'padding-bottom')) ?? padding?.bottom,
    paddingLeft: parseNonNegative(attr(node, 'padding-left')) ?? padding?.left,
    overflow: parseBoundEnum(attr(node, 'overflow'), OVERFLOW_MODES),
  });
}

function pagePadding(value: number | string | undefined): BoxLength | string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return { mode: 'px', value };
  }
  return undefined;
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
  if (compact.overflow) {
    attrs['@_overflow'] = compact.overflow;
  }
  writeEdges(
    attrs,
    'padding',
    pagePadding(compact.paddingTop),
    pagePadding(compact.paddingRight),
    pagePadding(compact.paddingBottom),
    pagePadding(compact.paddingLeft),
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
      const computed = (type === 'arr' || type === 'obj') && attr(child, 'computed') === '1';
      const dynamic = (type === 'arr' || type === 'obj') && (attr(child, 'dynamic') === '1' || computed);
      const of = type === 'arr' || type === 'obj' ? attr(child, 'of').trim() : '';
      const variable: PageVariable = {
        type,
        name,
        value,
        ...(desc ? { desc } : {}),
        ...(watch ? { watch } : {}),
        ...(of ? { of } : {}),
        ...(dynamic ? { dynamic: true } : {}),
        ...(computed ? { computed: true } : {}),
      };
      return [variable];
    }
    return [];
  });

  return variables.length > 0 ? variables : undefined;
}

function parseMethodParams(nodes: OrderedNode[], tag: 'in' | 'out'): PageMethodParam[] {
  const params: PageMethodParam[] = [];
  for (const item of nodes) {
    if (!Object.prototype.hasOwnProperty.call(item, tag)) {
      continue;
    }
    const name = attr(item, 'name').trim();
    const type = attr(item, 'type').trim();
    if (!isPageMethodParamName(name) || !isPageMethodParamType(type)) {
      continue;
    }
    params.push({ name, type });
  }
  return params;
}

function parsePageMethods(nodes: OrderedNode[]): PageMethod[] | undefined {
  const root = nodes.find((child) => Object.prototype.hasOwnProperty.call(child, 'methods'));
  if (!root) {
    return undefined;
  }
  const methods: PageMethod[] = [];
  const seen = new Set<string>();
  for (const child of nodeList(root.methods)) {
    if (!Object.prototype.hasOwnProperty.call(child, 'method')) {
      continue;
    }
    const id = attr(child, 'id').trim();
    const name = attr(child, 'name').trim();
    if (!isPageMethodId(id) || !isPageMethodName(name) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const desc = attr(child, 'desc').trim();
    const expose = attr(child, 'expose') === '1';
    const body = nodeList(child.method);
    const method: PageMethod = {
      id,
      name,
      params: parseMethodParams(body, 'in'),
      returns: parseMethodParams(body, 'out'),
      ...(desc ? { desc } : {}),
      ...(expose ? { expose: true } : {}),
    };
    methods.push(method);
  }
  return methods.length > 0 ? methods : undefined;
}

function parseComponentProps(nodes: OrderedNode[]): ComponentProp[] | undefined {
  return parseContractProps(nodes, 'props');
}

function parsePageQuery(nodes: OrderedNode[]): ComponentProp[] | undefined {
  return parseContractProps(nodes, 'query');
}

function parseContractProps(nodes: OrderedNode[], tag: 'props' | 'query'): ComponentProp[] | undefined {
  const root = nodes.find((child) => Object.prototype.hasOwnProperty.call(child, tag));
  if (!root) {
    return undefined;
  }
  const props: ComponentProp[] = [];
  const seen = new Set<string>();
  for (const child of nodeList(root[tag])) {
    const type = COMPONENT_PROP_TYPES.find((item) => Object.prototype.hasOwnProperty.call(child, item));
    if (!type) {
      continue;
    }
    const name = attr(child, 'n').trim();
    if (!name || !isJsIdentifier(name) || seen.has(name)) {
      continue;
    }
    seen.add(name);
    const raw = elementText(child[type]);
    const value = type === 'bool' ? (raw === '1' ? '1' : '0') : raw;
    const desc = attr(child, 'desc').trim();
    const required = tag === 'props' && attr(child, 'required') === '1';
    const bind = tag === 'props' && attr(child, 'bind') === '1';
    const of = tag === 'props' && (type === 'arr' || type === 'obj') ? attr(child, 'of').trim() : '';
    props.push({
      name,
      type,
      value,
      ...(desc ? { desc } : {}),
      ...(required ? { required: true } : {}),
      ...(bind ? { bind: true } : {}),
      ...(of ? { of } : {}),
    });
  }
  return props.length > 0 ? props : undefined;
}

function parseComponentEmits(nodes: OrderedNode[]): ComponentEmit[] | undefined {
  const root = nodes.find((child) => Object.prototype.hasOwnProperty.call(child, 'emits'));
  if (!root) {
    return undefined;
  }
  const emits: ComponentEmit[] = [];
  const seen = new Set<string>();
  for (const child of nodeList(root.emits)) {
    if (!Object.prototype.hasOwnProperty.call(child, 'emit')) {
      continue;
    }
    const name = attr(child, 'name').trim();
    if (!name || !isJsIdentifier(name) || seen.has(name)) {
      continue;
    }
    seen.add(name);
    const desc = attr(child, 'desc').trim();
    emits.push({
      name,
      params: parseMethodParams(nodeList(child.emit), 'in'),
      ...(desc ? { desc } : {}),
    });
  }
  return emits.length > 0 ? emits : undefined;
}

function parseTestBag(nodes: OrderedNode[], types: readonly string[]): Record<string, string> | undefined {
  const bag: Record<string, string> = {};
  for (const child of nodes) {
    const type = types.find((item) => Object.prototype.hasOwnProperty.call(child, item));
    if (!type) {
      continue;
    }
    const name = attr(child, 'n').trim();
    if (!name || !isJsIdentifier(name) || Object.prototype.hasOwnProperty.call(bag, name)) {
      continue;
    }
    const raw = elementText(child[type]);
    bag[name] = type === 'bool' ? (raw === '1' ? '1' : '0') : raw;
  }
  return Object.keys(bag).length > 0 ? bag : undefined;
}

function parseTestData(nodes: OrderedNode[]): PageTestData | undefined {
  const root = nodes.find((child) => Object.prototype.hasOwnProperty.call(child, 'testData'));
  if (!root) {
    return undefined;
  }
  const body = nodeList(root.testData);
  const propsNode = body.find((child) => Object.prototype.hasOwnProperty.call(child, 'props'));
  const queryNode = body.find((child) => Object.prototype.hasOwnProperty.call(child, 'query'));
  const dataNode = body.find((child) => Object.prototype.hasOwnProperty.call(child, 'data'));
  const props = propsNode ? parseTestBag(nodeList(propsNode.props), COMPONENT_PROP_TYPES) : undefined;
  const query = queryNode ? parseTestBag(nodeList(queryNode.query), COMPONENT_PROP_TYPES) : undefined;
  const data = dataNode ? parseTestBag(nodeList(dataNode.data), PAGE_DATA_TYPES) : undefined;
  if (!props && !query && !data) {
    return undefined;
  }
  return {
    ...(props ? { props } : {}),
    ...(query ? { query } : {}),
    ...(data ? { data } : {}),
  };
}

function splitPageChildren(nodes: OrderedNode[]): {
  widgets: OrderedNode[];
  data?: PageVariable[];
  methods?: PageMethod[];
  props?: ComponentProp[];
  query?: ComponentProp[];
  emits?: ComponentEmit[];
  testData?: PageTestData;
} {
  const data = parsePageData(nodes);
  const methods = parsePageMethods(nodes);
  const props = parseComponentProps(nodes);
  const query = parsePageQuery(nodes);
  const emits = parseComponentEmits(nodes);
  const testData = compactPageTestData(parseTestData(nodes), props, data, query);
  const widgets = nodes.filter(
    (child) =>
      !Object.prototype.hasOwnProperty.call(child, 'data') &&
      !Object.prototype.hasOwnProperty.call(child, 'i18n') &&
      !Object.prototype.hasOwnProperty.call(child, 'methods') &&
      !Object.prototype.hasOwnProperty.call(child, 'props') &&
      !Object.prototype.hasOwnProperty.call(child, 'query') &&
      !Object.prototype.hasOwnProperty.call(child, 'emits') &&
      !Object.prototype.hasOwnProperty.call(child, 'testData'),
  );
  return {
    widgets,
    ...(data ? { data } : {}),
    ...(methods ? { methods } : {}),
    ...(props ? { props } : {}),
    ...(query ? { query } : {}),
    ...(emits ? { emits } : {}),
    ...(testData ? { testData } : {}),
  };
}

function parseComponentArgs(nodes: OrderedNode[]): Record<string, string> | undefined {
  const args: Record<string, string> = {};
  for (const child of nodes) {
    if (!Object.prototype.hasOwnProperty.call(child, 'arg')) {
      continue;
    }
    const name = attr(child, 'n').trim();
    const value = elementText(child.arg).trim();
    if (!isJsIdentifier(name) || !value) {
      continue;
    }
    args[name] = value;
  }
  return compactComponentArgs(args);
}

function serializeComponentArgs(args: Record<string, string> | undefined): OrderedNode[] {
  const compact = compactComponentArgs(args);
  if (!compact) {
    return [];
  }
  return Object.entries(compact).map(([name, value]) => ({
    arg: [{ '#text': value }],
    ':@': { '@_n': name },
  }));
}

function serializeComponentProps(props: ComponentProp[]): OrderedNode {
  return serializeContractProps('props', props);
}

function serializePageQuery(query: ComponentProp[]): OrderedNode {
  return serializeContractProps('query', query);
}

function serializeContractProps(tag: 'props' | 'query', props: ComponentProp[]): OrderedNode {
  return {
    [tag]: props.map((prop) => {
      const attrs: Record<string, string> = { '@_n': prop.name };
      const desc = prop.desc?.trim();
      if (desc) {
        attrs['@_desc'] = desc;
      }
      if (tag === 'props' && prop.required) {
        attrs['@_required'] = '1';
      }
      if (tag === 'props' && prop.bind) {
        attrs['@_bind'] = '1';
      }
      if (tag === 'props' && prop.of && (prop.type === 'arr' || prop.type === 'obj')) {
        attrs['@_of'] = prop.of;
      }
      return {
        [prop.type]: [{ '#text': prop.value }],
        ':@': attrs,
      };
    }),
  };
}

function serializeComponentEmits(emits: ComponentEmit[]): OrderedNode {
  return {
    emits: emits.map((emit) => {
      const attrs: Record<string, string> = { '@_name': emit.name };
      const desc = emit.desc?.trim();
      if (desc) {
        attrs['@_desc'] = desc;
      }
      return {
        emit: emit.params.map((param) => serializeMethodParam('in', param)),
        ':@': attrs,
      };
    }),
  };
}

function serializeMethodParam(tag: 'in' | 'out', param: PageMethodParam): OrderedNode {
  return {
    [tag]: [],
    ':@': { '@_name': param.name, '@_type': param.type },
  };
}

function serializePageMethods(methods: PageMethod[]): OrderedNode {
  return {
    methods: methods.map((method) => {
      const attrs: Record<string, string> = { '@_id': method.id, '@_name': method.name };
      const desc = method.desc?.trim();
      if (desc) {
        attrs['@_desc'] = desc;
      }
      if (method.expose) {
        attrs['@_expose'] = '1';
      }
      return {
        method: [
          ...method.params.map((param) => serializeMethodParam('in', param)),
          ...method.returns.map((param) => serializeMethodParam('out', param)),
        ],
        ':@': attrs,
      };
    }),
  };
}

function serializeTestBag(
  tag: 'props' | 'query' | 'data',
  values: Record<string, string>,
  types: ReadonlyMap<string, string>,
): OrderedNode {
  return {
    [tag]: Object.entries(values).flatMap(([name, value]) => {
      const type = types.get(name);
      if (!type) {
        return [];
      }
      return [
        {
          [type]: [{ '#text': value }],
          ':@': { '@_n': name },
        },
      ];
    }),
  };
}

function serializeTestData(
  testData: PageTestData,
  props: ComponentProp[] | undefined,
  data: PageVariable[] | undefined,
  query?: ComponentProp[],
): OrderedNode | undefined {
  const compact = compactPageTestData(testData, props, data, query);
  if (!compact) {
    return undefined;
  }
  const children: OrderedNode[] = [];
  if (compact.props) {
    children.push(serializeTestBag('props', compact.props, new Map((props ?? []).map((item) => [item.name, item.type]))));
  }
  if (compact.query) {
    children.push(serializeTestBag('query', compact.query, new Map((query ?? []).map((item) => [item.name, item.type]))));
  }
  if (compact.data) {
    children.push(serializeTestBag('data', compact.data, new Map((data ?? []).map((item) => [item.name, item.type]))));
  }
  if (children.length === 0) {
    return undefined;
  }
  return { testData: children };
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
      if ((variable.type === 'arr' || variable.type === 'obj') && variable.dynamic) {
        attrs['@_dynamic'] = '1';
      }
      if ((variable.type === 'arr' || variable.type === 'obj') && variable.computed) {
        attrs['@_computed'] = '1';
      }
      if ((variable.type === 'arr' || variable.type === 'obj') && variable.of) {
        attrs['@_of'] = variable.of;
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
    ...('value' in widget && widget.type !== 'checkbox' && widget.type !== 'switch' ? { value: widget.value } : {}),
    ...('text' in widget ? { text: widget.text } : {}),
    ...('src' in widget ? { src: widget.src } : {}),
    ...('size' in widget && typeof widget.size === 'number' ? { size: widget.size } : {}),
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

function compactTransition(value: number | string | undefined): number | string | undefined {
  if (typeof value === 'string') {
    return storedBinding(value);
  }
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.round(value);
}

function stateTransition(widget: PageWidget, id: string | null | undefined): number | string | undefined {
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
  if (widget.type === 'button' || widget.type === 'checkbox') {
    return props.text != null ? { ...widget, text: props.text } : widget;
  }
  if (widget.type === 'input') {
    return props.value != null ? { ...widget, value: props.value } : widget;
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
  transition?: number | string,
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
  inheritedTransition?: number | string,
): number | string | undefined {
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
  inheritedTransition: number | string | undefined,
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
    if (typeof num === 'number' && num > 0) {
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
      : widget.type === 'scroll'
        ? 'scroll'
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
    widget.type === 'scroll' ||
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
        ...parseWidgetEvents(child),
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
        ...parseWidgetEvents(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.hoverStateId ? { hoverStateId: extra.hoverStateId } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowContent && Object.prototype.hasOwnProperty.call(child, 'component')) {
      ids.n += 1;
      const style = parseStyle(child);
      const item = asItem ? parseItem(child) : undefined;
      const componentNodes = nodeList(child.component);
      const extra = widgetStateSpread(child, componentNodes, ancestorIds);
      const args = parseComponentArgs(componentNodes);
      const name = attr(child, 'name').trim();
      widgets.push({
        type: 'component',
        id: attr(child, 'id') || `n${ids.n}`,
        componentId: attr(child, 'component-id').trim(),
        componentKey: attr(child, 'component-key').trim(),
        name,
        ...(args ? { args } : {}),
        ...(style ? { style } : {}),
        ...(item ? { item } : {}),
        ...parseWidgetLoop(child),
        ...parseWidgetHidden(child),
        ...parseWidgetAlias(child),
        ...parseWidgetEvents(child),
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
        ...parseWidgetEvents(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.hoverStateId ? { hoverStateId: extra.hoverStateId } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowContent && Object.prototype.hasOwnProperty.call(child, 'input')) {
      ids.n += 1;
      const style = parseStyle(child);
      const item = asItem ? parseItem(child) : undefined;
      const extra = widgetStateSpread(child, nodeList(child.input), ancestorIds);
      const inputType = parseBoundEnum(attr(child, 'type'), INPUT_TYPES);
      const modelValue = attr(child, 'model-value').trim();
      const placeholder = attr(child, 'placeholder');
      widgets.push({
        type: 'input',
        id: attr(child, 'id') || `n${ids.n}`,
        value: attr(child, 'value'),
        ...(inputType && inputType !== 'text' ? { inputType } : {}),
        ...(modelValue ? { modelValue } : {}),
        ...(placeholder ? { placeholder } : {}),
        ...(style ? { style } : {}),
        ...(item ? { item } : {}),
        ...parseWidgetLoop(child),
        ...parseWidgetHidden(child),
        ...parseWidgetAlias(child),
        ...parseWidgetEvents(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.hoverStateId ? { hoverStateId: extra.hoverStateId } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowContent && Object.prototype.hasOwnProperty.call(child, 'checkbox')) {
      ids.n += 1;
      const style = parseStyle(child);
      const item = asItem ? parseItem(child) : undefined;
      const extra = widgetStateSpread(child, nodeList(child.checkbox), ancestorIds);
      const selected = attr(child, 'selected').trim();
      widgets.push({
        type: 'checkbox',
        id: attr(child, 'id') || `n${ids.n}`,
        text: attr(child, 'text'),
        value: attr(child, 'value'),
        ...(storedBinding(attr(child, 'checked'))
          ? { checked: storedBinding(attr(child, 'checked')) }
          : isTrue(attr(child, 'checked'))
            ? { checked: true }
            : {}),
        ...(selected ? { selected } : {}),
        ...(style ? { style } : {}),
        ...(item ? { item } : {}),
        ...parseWidgetLoop(child),
        ...parseWidgetHidden(child),
        ...parseWidgetAlias(child),
        ...parseWidgetEvents(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.hoverStateId ? { hoverStateId: extra.hoverStateId } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowContent && Object.prototype.hasOwnProperty.call(child, 'switch')) {
      ids.n += 1;
      const style = parseStyle(child);
      const item = asItem ? parseItem(child) : undefined;
      const extra = widgetStateSpread(child, nodeList(child.switch), ancestorIds);
      const modelValue = attr(child, 'model-value').trim();
      widgets.push({
        type: 'switch',
        id: attr(child, 'id') || `n${ids.n}`,
        value: storedBinding(attr(child, 'value')) ?? isTrue(attr(child, 'value')),
        ...(modelValue ? { modelValue } : {}),
        ...(style ? { style } : {}),
        ...(item ? { item } : {}),
        ...parseWidgetLoop(child),
        ...parseWidgetHidden(child),
        ...parseWidgetAlias(child),
        ...parseWidgetEvents(child),
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
        ...parseWidgetEvents(child),
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
        ...parseWidgetEvents(child),
        ...(extra.states ? { states: extra.states } : {}),
        ...(extra.stateOverrides ? { stateOverrides: extra.stateOverrides } : {}),
        ...(extra.stateFn ? { stateFn: extra.stateFn } : {}),
        ...(extra.hoverStateId ? { hoverStateId: extra.hoverStateId } : {}),
        ...(extra.transition ? { transition: extra.transition } : {}),
      });
      continue;
    }
    if (allowContent && Object.prototype.hasOwnProperty.call(child, 'scroll')) {
      ids.n += 1;
      const style = sanitizeWidgetStyle('scroll', parseStyle(child));
      const item = asItem ? parseItem(child) : undefined;
      const extra = widgetStateSpread(child, nodeList(child.scroll), ancestorIds);
      const nextIds = [...ancestorIds, ...extraDeclaredIds(extra)];
      const scrollX = attr(child, 'scroll-x') === 'false' ? false : undefined;
      const scrollY = attr(child, 'scroll-y') === 'false' ? false : undefined;
      widgets.push({
        type: 'scroll',
        id: attr(child, 'id') || `n${ids.n}`,
        children: parseWidgets(extra.rest, ids, 'scroll', nextIds),
        ...(style ? { style } : {}),
        ...(scrollX === false ? { scrollX } : {}),
        ...(scrollY === false ? { scrollY } : {}),
        ...(item ? { item } : {}),
        ...parseWidgetLoop(child),
        ...parseWidgetHidden(child),
        ...parseWidgetAlias(child),
        ...parseWidgetEvents(child),
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
        ...parseWidgetEvents(child),
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
        ...parseWidgetEvents(child),
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
        ...parseWidgetEvents(child),
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
        ...parseWidgetEvents(child),
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
        ...parseWidgetEvents(child),
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
        ...parseWidgetEvents(child),
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
    ...widgetEventAttrs(widget.type, widget.events),
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
    if (widget.type === 'component') {
      return {
        component: [...serializeComponentArgs(widget.args), ...inner],
        ':@': widgetHostAttrs(widget, id, style, {
          '@_component-id': widget.componentId,
          '@_component-key': widget.componentKey,
          '@_name': widget.name,
          ...item,
        }),
      };
    }
    if (widget.type === 'button') {
      return {
        button: inner,
        ':@': widgetHostAttrs(widget, id, style, { '@_text': widget.text, ...item }),
      };
    }
    if (widget.type === 'input') {
      return {
        input: inner,
        ':@': widgetHostAttrs(widget, id, style, {
          '@_value': widget.value,
          ...(widget.inputType && widget.inputType !== 'text' ? { '@_type': widget.inputType } : {}),
          ...(widget.modelValue?.trim() ? { '@_model-value': widget.modelValue.trim() } : {}),
          ...(widget.placeholder ? { '@_placeholder': widget.placeholder } : {}),
          ...item,
        }),
      };
    }
    if (widget.type === 'checkbox') {
      return {
        checkbox: inner,
        ':@': widgetHostAttrs(widget, id, style, {
          '@_text': widget.text,
          '@_value': widget.value,
          ...(typeof widget.checked === 'string'
            ? { '@_checked': widget.checked }
            : widget.checked
              ? { '@_checked': 'true' }
              : {}),
          ...(widget.selected?.trim() ? { '@_selected': widget.selected.trim() } : {}),
          ...item,
        }),
      };
    }
    if (widget.type === 'switch') {
      return {
        switch: inner,
        ':@': widgetHostAttrs(widget, id, style, {
          '@_value': typeof widget.value === 'string' ? widget.value : widget.value ? 'true' : 'false',
          ...(widget.modelValue?.trim() ? { '@_model-value': widget.modelValue.trim() } : {}),
          ...item,
        }),
      };
    }
    if (widget.type === 'flex') {
      return {
        flex: inner,
        ':@': widgetHostAttrs(widget, id, style, { ...flexAttrs(widget.flex), ...item }),
      };
    }
    if (widget.type === 'scroll') {
      return {
        scroll: inner,
        ':@': widgetHostAttrs(widget, id, style, {
          ...(widget.scrollX === false ? { '@_scroll-x': 'false' } : {}),
          ...(widget.scrollY === false ? { '@_scroll-y': 'false' } : {}),
          ...item,
        }),
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

/** XML 规范不允许属性名以 @ 开头，校验前先把 `@click` 换成合法名字。真正解析仍保留 `@click`。 */
function xmlForValidation(xml: string): string {
  return xml.replace(/(\s)@([A-Za-z_][\w:-]*)=/g, '$1e-$2=');
}

export function parsePageXml(xml: string): PageXmlDocument {
  const result = XMLValidator.validate(xmlForValidation(xml));
  if (result !== true) {
    throw new XmlParseError(result.err.msg);
  }

  const pageNode = findPageRoot(pageParser.parse(xml));
  const style = parsePageStyle(pageNode);
  const events = parsePageEvents(pageNode);
  const { widgets, data, methods, props, query, emits, testData } = splitPageChildren(nodeList(pageNode.page));
  return {
    widgets: parseWidgets(widgets, { n: 0 }, 'page'),
    ...(style ? { style } : {}),
    ...(data ? { data } : {}),
    ...(events ? { events } : {}),
    ...(methods ? { methods } : {}),
    ...(props ? { props } : {}),
    ...(query ? { query } : {}),
    ...(emits ? { emits } : {}),
    ...(testData ? { testData } : {}),
  };
}

export function pageMethodIds(xml: string): string[] {
  try {
    return documentMethodIds(parsePageXml(xml));
  } catch {
    return [];
  }
}

export function documentMethodIds(page: PageXmlDocument): string[] {
  return [...new Set((page.methods ?? []).map((method) => method.id))];
}

/** 一份页面文档里出现过的事件 id。同一版本里重复引用只算一次。 */
export function documentEventIds(page: PageXmlDocument): string[] {
  const ids = new Set<string>();
  collectEventIds(page.events, ids);
  collectWidgetEventIds(page.widgets, ids);
  return [...ids];
}

function collectWidgetEventIds(widgets: PageWidget[], ids: Set<string>) {
  for (const widget of widgets) {
    collectEventIds(widget.events, ids);
    if ('children' in widget && widget.children) {
      collectWidgetEventIds(widget.children, ids);
    }
  }
}

function collectEventIds(events: WidgetEvents | undefined, ids: Set<string>) {
  if (!events) {
    return;
  }
  for (const [name, value] of Object.entries(events)) {
    if (name === 'order' || !Array.isArray(value)) {
      continue;
    }
    for (const id of value) {
      if (isWidgetEventId(id)) {
        ids.add(id);
      }
    }
  }
}

/** 用现有控件规则把一份页面文档收成规范形状。存储和接口只保留返回的对象。 */
export function normalizePageDocument(input: unknown): PageXmlDocument {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new XmlParseError('Invalid page document');
  }
  const page = input as PageXmlDocument;
  if (!Array.isArray(page.widgets)) {
    throw new XmlParseError('Invalid page document');
  }
  return parsePageXml(
    serializePageXml({
      widgets: page.widgets,
      ...(page.style ? { style: page.style } : {}),
      ...(page.data && page.data.length > 0 ? { data: page.data } : {}),
      ...(page.events ? { events: page.events } : {}),
      ...(page.methods && page.methods.length > 0 ? { methods: page.methods } : {}),
      ...(page.props && page.props.length > 0 ? { props: page.props } : {}),
      ...(page.query && page.query.length > 0 ? { query: page.query } : {}),
      ...(page.emits && page.emits.length > 0 ? { emits: page.emits } : {}),
      ...(page.testData ? { testData: page.testData } : {}),
    }),
  );
}

export function serializePageXml(page: PageXmlDocument): string {
  const attrs = { ...pageStyleAttrs(page.style), ...pageEventAttrs(page.events) };
  const testData = page.testData ? serializeTestData(page.testData, page.props, page.data, page.query) : undefined;
  const children = [
    ...(page.props && page.props.length > 0 ? [serializeComponentProps(page.props)] : []),
    ...(page.query && page.query.length > 0 ? [serializePageQuery(page.query)] : []),
    ...(page.emits && page.emits.length > 0 ? [serializeComponentEmits(page.emits)] : []),
    ...(page.data && page.data.length > 0 ? [serializePageData(page.data)] : []),
    ...(testData ? [testData] : []),
    ...(page.methods && page.methods.length > 0 ? [serializePageMethods(page.methods)] : []),
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

export const EMPTY_PAGE_DOCUMENT: PageXmlDocument = { widgets: [] };

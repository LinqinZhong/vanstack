import type {
  FlexContainerStyle,
  FlexItemStyle,
  PageWidget,
  SwiperStyle,
  TableAlign,
  TableLines,
  TableValign,
  WidgetLoop,
  WidgetStyle,
} from '@vanstack/xml';

export type WidgetPatch = {
  value?: string;
  text?: string;
  src?: string;
  size?: number;
  hidden?: boolean;
  alias?: string;
  loop?: WidgetLoop | undefined;
  stateFn?: string | undefined;
  hoverStateId?: string | undefined;
  style?: WidgetStyle | undefined;
  flex?: FlexContainerStyle | undefined;
  swiper?: SwiperStyle | undefined;
  item?: FlexItemStyle | undefined;
  freezeHeader?: boolean;
  freezeFooter?: boolean;
  headerHeight?: number;
  lines?: TableLines;
  width?: number;
  height?: number;
  align?: TableAlign;
  valign?: TableValign;
};

export type WidgetTranslate = (key: string) => string;

export type WidgetCreateContext = {
  id: string;
  t: WidgetTranslate;
  nextId: () => string;
};

export type WidgetCloneContext = {
  nextId: () => string;
  stateIdMap: Map<string, string>;
  cloneChild: (widget: PageWidget) => PageWidget;
};

/** `content` accepts every widget except swiper pages and table parts. */
export type WidgetAccepts = 'none' | 'content' | 'swiper-item' | 'table-section' | 'table-cell';

export interface WidgetHelperInterface<T extends PageWidget = PageWidget> {
  readonly type: T['type'];
  /** i18n key for the picker and the tree type name. */
  readonly nameKey: string;
  readonly container: boolean;
  /** Swiper items cannot sit on the page or inside a flex container. */
  readonly allowRoot: boolean;
  readonly accepts: WidgetAccepts;
  create(ctx: WidgetCreateContext): T;
  clone(widget: T, ctx: WidgetCloneContext): T;
  patch(widget: T, patch: WidgetPatch): T;
  /** Text shown after the type name in the widget tree. */
  treeSuffix?(widget: T): string;
}

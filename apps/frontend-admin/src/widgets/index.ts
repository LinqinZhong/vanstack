import type { PageWidget } from '@vanstack/xml';
import { buttonHelper } from './button';
import { flexHelper } from './flex';
import { iconHelper } from './icon';
import { imageHelper } from './image';
import { swiperHelper } from './swiper';
import { swiperItemHelper } from './swiper-item';
import { textHelper } from './text';
import type { WidgetAccepts, WidgetCloneContext, WidgetCreateContext, WidgetHelperInterface, WidgetPatch, WidgetTranslate } from './types';

export type { WidgetAccepts, WidgetCloneContext, WidgetCreateContext, WidgetHelperInterface, WidgetPatch, WidgetTranslate };

export const widgetHelpers = {
  image: imageHelper,
  icon: iconHelper,
  text: textHelper,
  button: buttonHelper,
  flex: flexHelper,
  swiper: swiperHelper,
  'swiper-item': swiperItemHelper,
} satisfies { [K in PageWidget['type']]: WidgetHelperInterface<Extract<PageWidget, { type: K }>> };

export const ADDABLE_WIDGET_TYPES = ['text', 'button', 'flex', 'swiper', 'swiper-item', 'image', 'icon'] as const satisfies readonly PageWidget['type'][];

export function acceptsChild(accepts: WidgetAccepts, childType: PageWidget['type']): boolean {
  if (accepts === 'none') {
    return false;
  }
  if (accepts === 'swiper-item') {
    return childType === 'swiper-item';
  }
  return childType !== 'swiper-item';
}

function helperFor(type: PageWidget['type']): WidgetHelperInterface<PageWidget> {
  return widgetHelpers[type] as unknown as WidgetHelperInterface<PageWidget>;
}

export function createWidget(type: PageWidget['type'], ctx: WidgetCreateContext): PageWidget {
  return helperFor(type).create(ctx);
}

export function cloneWidgetByType(widget: PageWidget, ctx: WidgetCloneContext): PageWidget {
  return helperFor(widget.type).clone(widget, ctx);
}

export function patchWidget(widget: PageWidget, patch: WidgetPatch): PageWidget {
  return helperFor(widget.type).patch(widget, patch);
}

export function widgetTypeName(type: PageWidget['type'], t: WidgetTranslate): string {
  return t(widgetHelpers[type].nameKey);
}

export function widgetTreeLabel(widget: PageWidget, t: WidgetTranslate): string {
  const typeName = widgetTypeName(widget.type, t);
  const suffix = helperFor(widget.type).treeSuffix?.(widget);
  return suffix != null ? `${typeName} · ${suffix}` : typeName;
}

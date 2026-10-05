import type { PageWidget } from '@vanstack/xml';
import { buttonHelper } from './button';
import { componentHelper } from './component';
import { checkboxHelper } from './checkbox';
import { switchHelper } from './switch';
import { flexHelper } from './flex';
import { iconHelper } from './icon';
import { inputHelper } from './input';
import { imageHelper } from './image';
import { swiperHelper } from './swiper';
import { swiperItemHelper } from './swiper-item';
import { tableCellHelper } from './td';
import { tableHeaderHelper } from './th';
import { tableHelper } from './table';
import { tableRowHelper } from './tr';
import { textHelper } from './text';
import type { WidgetAccepts, WidgetCloneContext, WidgetCreateContext, WidgetHelperInterface, WidgetPatch, WidgetTranslate } from './types';

export type { WidgetAccepts, WidgetCloneContext, WidgetCreateContext, WidgetHelperInterface, WidgetPatch, WidgetTranslate };

export const widgetHelpers = {
  image: imageHelper,
  icon: iconHelper,
  text: textHelper,
  input: inputHelper,
  checkbox: checkboxHelper,
  switch: switchHelper,
  button: buttonHelper,
  component: componentHelper,
  flex: flexHelper,
  swiper: swiperHelper,
  'swiper-item': swiperItemHelper,
  table: tableHelper,
  th: tableHeaderHelper,
  tr: tableRowHelper,
  td: tableCellHelper,
} satisfies { [K in PageWidget['type']]: WidgetHelperInterface<Extract<PageWidget, { type: K }>> };

export const ADDABLE_WIDGET_TYPES = ['text', 'input', 'checkbox', 'switch', 'button', 'flex', 'swiper', 'table', 'swiper-item', 'image', 'icon'] as const satisfies readonly PageWidget['type'][];

export function acceptsChild(accepts: WidgetAccepts, childType: PageWidget['type']): boolean {
  if (accepts === 'none') {
    return false;
  }
  if (accepts === 'swiper-item') {
    return childType === 'swiper-item';
  }
  if (accepts === 'table-section') {
    return childType === 'th' || childType === 'tr';
  }
  if (accepts === 'table-cell') {
    return childType === 'td';
  }
  return childType !== 'swiper-item' && childType !== 'th' && childType !== 'tr' && childType !== 'td';
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
  return suffix ? `${typeName} · ${suffix}` : typeName;
}

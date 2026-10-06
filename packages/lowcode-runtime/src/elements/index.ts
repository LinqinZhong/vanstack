import { cloneElement, type ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { widgetRuntimeBindings, withDomEvents } from '../events';
import { renderButton } from './button';
import { renderComponent } from './component';
import { renderCheckbox } from './checkbox';
import { renderSwitch } from './switch';
import { renderFlex } from './flex';
import { renderScroll } from './scroll';
import { renderIcon } from './icon';
import { renderInput } from './input';
import { renderImage } from './image';
import { renderSwiper } from './swiper';
import { renderSwiperItem } from './swiper-item';
import { renderTable, renderTd, renderTh, renderTr } from './table';
import { renderText } from './text';
import type { WidgetRenderContext } from '../widget-render';

export function widgetElement(widget: PageWidget, ctx: WidgetRenderContext): ReactElement {
  const node = renderWidget(widget, ctx);
  if (ctx.editing) {
    return node;
  }
  const bindings = widgetRuntimeBindings(widget, ctx.loadWidgetEvent, {
    data: ctx.bindingScope.data,
    props: ctx.bindingScope.props,
    query: ctx.bindingScope.query,
    aliases: ctx.bindingScope.aliases,
    assign: ctx.assignScope,
  });
  if (!bindings) {
    return node;
  }
  if (typeof node.type === 'string') {
    return withDomEvents(node, bindings, widget.type === 'image');
  }
  return cloneElement(node as ReactElement<{ eventHandlers?: typeof bindings.dom; onIndexChange?: (index: number, oldIndex: number) => void }>, {
    eventHandlers: bindings.dom,
    onIndexChange: bindings.onIndexChange,
  });
}

function renderWidget(widget: PageWidget, ctx: WidgetRenderContext): ReactElement {
  switch (widget.type) {
    case 'image':
      return renderImage(widget, ctx);
    case 'icon':
      return renderIcon(widget, ctx);
    case 'text':
      return renderText(widget, ctx);
    case 'component':
      return renderComponent(widget, ctx);
    case 'input':
      return renderInput(widget, ctx);
    case 'checkbox':
      return renderCheckbox(widget, ctx);
    case 'switch':
      return renderSwitch(widget, ctx);
    case 'button':
      return renderButton(widget, ctx);
    case 'flex':
      return renderFlex(widget, ctx);
    case 'scroll':
      return renderScroll(widget, ctx);
    case 'swiper':
      return renderSwiper(widget, ctx);
    case 'swiper-item':
      return renderSwiperItem(widget, ctx);
    case 'table':
      return renderTable(widget, ctx);
    case 'th':
      return renderTh(widget, ctx);
    case 'tr':
      return renderTr(widget, ctx);
    case 'td':
      return renderTd(widget, ctx);
  }
}

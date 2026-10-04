import type { ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { renderButton } from './button';
import { renderFlex } from './flex';
import { renderIcon } from './icon';
import { renderImage } from './image';
import { renderSwiper } from './swiper';
import { renderSwiperItem } from './swiper-item';
import { renderTable, renderTd, renderTh, renderTr } from './table';
import { renderText } from './text';
import type { WidgetRenderContext } from '../widget-render';

export function widgetElement(widget: PageWidget, ctx: WidgetRenderContext): ReactElement {
  switch (widget.type) {
    case 'image':
      return renderImage(widget, ctx);
    case 'icon':
      return renderIcon(widget, ctx);
    case 'text':
      return renderText(widget, ctx);
    case 'button':
      return renderButton(widget, ctx);
    case 'flex':
      return renderFlex(widget, ctx);
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

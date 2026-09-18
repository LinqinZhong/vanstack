import type { ReactElement } from 'react';
import type { PageWidget } from '@vanstack/xml';
import { renderButton } from './button';
import { renderFlex } from './flex';
import { renderSwiper } from './swiper';
import { renderSwiperItem } from './swiper-item';
import { renderText } from './text';
import type { WidgetRenderContext } from '../widget-render';

export function widgetElement(widget: PageWidget, ctx: WidgetRenderContext): ReactElement {
  switch (widget.type) {
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
  }
}

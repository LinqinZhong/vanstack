import type { ReactElement } from 'react';
import type { PageI18n, PageWidget } from '@vanstack/xml';

export type WidgetHoverHandlers = {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

export type WidgetRenderContext = {
  editing: boolean;
  animate: boolean;
  catalog: PageI18n | undefined;
  locale?: string;
  hoverFor: (widget: PageWidget) => WidgetHoverHandlers | undefined;
  render: (widget: PageWidget) => ReactElement;
};

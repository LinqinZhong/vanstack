import { isCopyBinding, sanitizeWidgetStyle, type PageWidget, type WidgetStyle } from '@vanstack/xml';
import { applyCommon, cloneItemField, cloneShared } from './common';
import type { WidgetHelperInterface } from './types';

const DEFAULT_ICON_SIZE = 24;

function iconSizeStyle(style: WidgetStyle | undefined, size: number): WidgetStyle {
  return (
    sanitizeWidgetStyle('icon', {
      ...style,
      width: { mode: 'px', value: size },
      height: { mode: 'px', value: size },
    }) ?? {
      width: { mode: 'px', value: size },
      height: { mode: 'px', value: size },
    }
  );
}

export const iconHelper = {
  type: 'icon',
  nameKey: 'lowcode.defaultIcon',
  container: false,
  allowRoot: true,
  accepts: 'none',
  create(ctx) {
    return {
      type: 'icon',
      id: ctx.id,
      src: '',
      size: DEFAULT_ICON_SIZE,
      style: iconSizeStyle(undefined, DEFAULT_ICON_SIZE),
    };
  },
  clone(widget, ctx) {
    const size = typeof widget.size === 'number' && widget.size > 0 ? widget.size : DEFAULT_ICON_SIZE;
    const shared = cloneShared(widget, ctx.stateIdMap);
    return {
      type: 'icon',
      id: ctx.nextId(),
      src: widget.src,
      ...(widget.size != null && (typeof widget.size === 'string' || widget.size > 0) ? { size: widget.size } : {}),
      ...shared,
      style: iconSizeStyle(shared.style, size),
      ...cloneItemField(widget),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if (patch.src != null) {
      next.src = patch.src;
    }
    if (patch.size != null) {
      if (typeof patch.size === 'string' && isCopyBinding(patch.size)) {
        next.size = patch.size.trim();
      } else if (typeof patch.size === 'number' && patch.size > 0) {
        next.size = patch.size;
        next.style = iconSizeStyle(next.style, patch.size);
      } else {
        delete next.size;
        next.style = iconSizeStyle(next.style, DEFAULT_ICON_SIZE);
      }
    }
    return next;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'icon' }>>;

import {
  DEFAULT_DRAWER_MASK,
  DEFAULT_DRAWER_PLACE,
  DEFAULT_DRAWER_SIZE,
  sanitizeWidgetStyle,
  type DrawerPlace,
  type PageWidget,
  type WidgetStyle,
} from '@vanstack/xml';
import { applyCommon, cloneChildren, cloneItemField, cloneShared } from './common';
import type { WidgetHelperInterface } from './types';

function percent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

const DRAWER_RADIUS_KEYS = ['radiusTopLeft', 'radiusTopRight', 'radiusBottomRight', 'radiusBottomLeft'] as const;

type DrawerRadiusKey = (typeof DRAWER_RADIUS_KEYS)[number];

/** 左右抽屉改宽度，上下抽屉改高度。 */
export function drawerSizeAxis(place: DrawerPlace): 'width' | 'height' {
  return place === 'left' || place === 'right' ? 'width' : 'height';
}

/** 尺寸拖杆在开口那边：贴底拖上边，贴右拖左边。 */
export function drawerResizeEdge(place: DrawerPlace): 'top' | 'right' | 'bottom' | 'left' {
  if (place === 'top') {
    return 'bottom';
  }
  if (place === 'left') {
    return 'right';
  }
  if (place === 'right') {
    return 'left';
  }
  return 'top';
}

/** 拖尺寸时保住当前单位。没写过尺寸时按百分比，和默认 40% 一致。 */
export function drawerStyleFromDrag(
  style: WidgetStyle | undefined,
  place: DrawerPlace,
  px: number,
  container: number,
): WidgetStyle | undefined {
  const axis = drawerSizeAxis(place);
  const current = style?.[axis];
  const percentMode = !(typeof current === 'object' && current.mode === 'px');
  const value = percentMode
    ? container > 0
      ? Math.min(100, Math.max(0, Math.round((px / container) * 100)))
      : typeof current === 'object' && current.mode === '%'
        ? current.value
        : 0
    : Math.max(0, Math.round(px));
  return compactDrawerStyle(
    { ...(style ?? {}), [axis]: { mode: percentMode ? '%' : 'px', value } },
    place,
  );
}

/** 露出的那一侧的两个圆角。下抽屉是上面两个角，右抽屉是左边两个角。 */
export function drawerRadiusKeys(place: DrawerPlace): [DrawerRadiusKey, DrawerRadiusKey] {
  if (place === 'top') {
    return ['radiusBottomLeft', 'radiusBottomRight'];
  }
  if (place === 'left') {
    return ['radiusTopRight', 'radiusBottomRight'];
  }
  if (place === 'right') {
    return ['radiusTopLeft', 'radiusBottomLeft'];
  }
  return ['radiusTopLeft', 'radiusTopRight'];
}

export function drawerRadiusValue(style: WidgetStyle | undefined, place: DrawerPlace): number | string | undefined {
  const [first, second] = drawerRadiusKeys(place);
  return style?.[first] ?? style?.[second];
}

/** 只留当前边用得到的尺寸和圆角。 */
export function compactDrawerStyle(style: WidgetStyle | undefined, place: DrawerPlace): WidgetStyle | undefined {
  const next: WidgetStyle = { ...(style ?? {}) };
  for (const key of Object.keys(next) as (keyof WidgetStyle)[]) {
    if (next[key] == null) {
      delete next[key];
    }
  }
  if (drawerSizeAxis(place) === 'width') {
    delete next.height;
  } else {
    delete next.width;
  }
  const [keepA, keepB] = drawerRadiusKeys(place);
  for (const key of DRAWER_RADIUS_KEYS) {
    if (key !== keepA && key !== keepB) {
      delete next[key];
    }
  }
  return sanitizeWidgetStyle('drawer', next);
}

/** 换边时，尺寸和圆角跟着挪到新的那一侧。 */
export function drawerStyleForPlace(
  style: WidgetStyle | undefined,
  from: DrawerPlace,
  to: DrawerPlace,
): WidgetStyle | undefined {
  const value = drawerRadiusValue(style, from);
  const [keepA, keepB] = drawerRadiusKeys(to);
  const next: WidgetStyle = { ...(style ?? {}) };
  for (const key of DRAWER_RADIUS_KEYS) {
    if (key === keepA || key === keepB) {
      if (value == null) {
        delete next[key];
      } else {
        next[key] = value;
      }
    } else {
      delete next[key];
    }
  }
  const fromAxis = drawerSizeAxis(from);
  const toAxis = drawerSizeAxis(to);
  if (fromAxis !== toAxis) {
    const sizeValue = next[fromAxis];
    if (sizeValue != null) {
      next[toAxis] = sizeValue;
    }
    delete next[fromAxis];
  }
  return compactDrawerStyle(next, to);
}

export const drawerHelper = {
  type: 'drawer',
  nameKey: 'lowcode.defaultDrawer',
  container: true,
  allowRoot: true,
  accepts: 'content',
  create(ctx) {
    return { type: 'drawer', id: ctx.id, children: [] };
  },
  clone(widget, ctx) {
    return {
      type: 'drawer',
      id: ctx.nextId(),
      children: cloneChildren(widget, ctx),
      ...(widget.place ? { place: widget.place } : {}),
      ...(widget.size != null ? { size: widget.size } : {}),
      ...(widget.mask != null ? { mask: widget.mask } : {}),
      ...(widget.maskClose === false ? { maskClose: false as const } : {}),
      ...cloneShared(widget, ctx.stateIdMap),
      ...cloneItemField(widget),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if ('place' in patch) {
      if (patch.place && patch.place !== DEFAULT_DRAWER_PLACE) {
        next.place = patch.place;
      } else {
        delete next.place;
      }
    }
    if ('size' in patch) {
      if (typeof patch.size === 'number' && percent(patch.size) !== DEFAULT_DRAWER_SIZE) {
        next.size = percent(patch.size);
      } else if (patch.size == null) {
        delete next.size;
      }
    }
    if ('mask' in patch) {
      if (typeof patch.mask === 'number' && percent(patch.mask) !== DEFAULT_DRAWER_MASK) {
        next.mask = percent(patch.mask);
      } else if (patch.mask == null) {
        delete next.mask;
      }
    }
    if ('maskClose' in patch) {
      if (patch.maskClose === false) {
        next.maskClose = false;
      } else {
        delete next.maskClose;
      }
    }
    return next;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'drawer' }>>;

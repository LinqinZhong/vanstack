import { isCopyBinding, type PageWidget } from '@vanstack/xml';
import { applyCommon, cloneItemField, cloneShared } from './common';
import type { WidgetHelperInterface } from './types';

function switchOn(raw: string | undefined): boolean | string {
  const trimmed = raw?.trim() ?? '';
  if (isCopyBinding(trimmed)) {
    return trimmed;
  }
  const token = trimmed.toLowerCase();
  return token === 'true' || token === '1';
}

export const switchHelper = {
  type: 'switch',
  nameKey: 'lowcode.defaultSwitch',
  container: false,
  allowRoot: true,
  accepts: 'none',
  create(ctx) {
    return {
      type: 'switch',
      id: ctx.id,
      value: false,
    };
  },
  clone(widget, ctx) {
    return {
      type: 'switch',
      id: ctx.nextId(),
      value: widget.value,
      ...(widget.modelValue?.trim() ? { modelValue: widget.modelValue.trim() } : {}),
      ...(widget.size != null ? { size: widget.size } : {}),
      ...(widget.activeColor?.trim() ? { activeColor: widget.activeColor.trim() } : {}),
      ...cloneShared(widget, ctx.stateIdMap),
      ...cloneItemField(widget),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if (patch.value != null) {
      next.value = switchOn(patch.value);
    }
    if ('modelValue' in patch) {
      const name = patch.modelValue?.trim();
      if (name) {
        next.modelValue = name;
      } else {
        delete next.modelValue;
      }
    }
    if ('size' in patch) {
      if (patch.size == null) {
        delete next.size;
      } else if (typeof patch.size === 'string' && isCopyBinding(patch.size)) {
        next.size = patch.size.trim();
      } else if (typeof patch.size === 'number' && patch.size > 0) {
        next.size = patch.size;
      } else if (typeof patch.size === 'string') {
        const num = Number(patch.size);
        if (Number.isFinite(num) && num > 0) {
          next.size = num;
        } else {
          delete next.size;
        }
      } else {
        delete next.size;
      }
    }
    if ('activeColor' in patch) {
      const color = patch.activeColor?.trim();
      if (color) {
        next.activeColor = color;
      } else {
        delete next.activeColor;
      }
    }
    return next;
  },
  treeSuffix(widget) {
    const bound = widget.modelValue?.trim();
    if (bound) {
      return bound;
    }
    return typeof widget.value === 'string' ? widget.value : widget.value ? 'true' : 'false';
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'switch' }>>;

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

import { isCopyBinding, type PageWidget } from '@vanstack/xml';
import { applyCommon, cloneItemField, cloneShared } from './common';
import type { WidgetHelperInterface } from './types';

export const checkboxHelper = {
  type: 'checkbox',
  nameKey: 'lowcode.defaultCheckbox',
  container: false,
  allowRoot: true,
  accepts: 'none',
  create(ctx) {
    return {
      type: 'checkbox',
      id: ctx.id,
      text: ctx.t('lowcode.defaultCheckbox'),
      value: '',
    };
  },
  clone(widget, ctx) {
    return {
      type: 'checkbox',
      id: ctx.nextId(),
      text: widget.text,
      value: widget.value,
      ...(widget.checked ? { checked: true } : {}),
      ...(widget.selected?.trim() ? { selected: widget.selected.trim() } : {}),
      ...cloneShared(widget, ctx.stateIdMap),
      ...cloneItemField(widget),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if (patch.text != null) {
      next.text = patch.text;
    }
    if (patch.value != null) {
      next.value = patch.value;
    }
    if ('checked' in patch) {
      if (typeof patch.checked === 'string' && isCopyBinding(patch.checked)) {
        next.checked = patch.checked.trim();
      } else if (patch.checked) {
        next.checked = true;
      } else {
        delete next.checked;
      }
    }
    if ('selected' in patch) {
      const name = patch.selected?.trim();
      if (name) {
        next.selected = name;
      } else {
        delete next.selected;
      }
    }
    return next;
  },
  treeSuffix(widget) {
    const bound = widget.selected?.trim();
    if (bound) {
      return bound;
    }
    return widget.text || undefined;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'checkbox' }>>;

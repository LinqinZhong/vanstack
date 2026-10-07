import type { PageWidget } from '@vanstack/xml';
import { applyCommon, cloneItemField, cloneShared } from './common';
import type { WidgetHelperInterface } from './types';

export const inputHelper = {
  type: 'input',
  nameKey: 'lowcode.defaultInput',
  container: false,
  allowRoot: true,
  accepts: 'none',
  create(ctx) {
    return { type: 'input', id: ctx.id, value: '' };
  },
  clone(widget, ctx) {
    return {
      type: 'input',
      id: ctx.nextId(),
      value: widget.value,
      ...(widget.inputType && widget.inputType !== 'text' ? { inputType: widget.inputType } : {}),
      ...(widget.modelValue?.trim() ? { modelValue: widget.modelValue.trim() } : {}),
      ...(widget.placeholder ? { placeholder: widget.placeholder } : {}),
      ...cloneShared(widget, ctx.stateIdMap),
      ...cloneItemField(widget),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if (patch.value != null) {
      next.value = patch.value;
    }
    if ('inputType' in patch) {
      if (patch.inputType && patch.inputType !== 'text') {
        next.inputType = patch.inputType;
      } else {
        delete next.inputType;
      }
    }
    if ('placeholder' in patch) {
      if (patch.placeholder) {
        next.placeholder = patch.placeholder;
      } else {
        delete next.placeholder;
      }
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
    const kind = widget.inputType === 'password' || widget.inputType === 'textarea' || widget.inputType === 'number' ? widget.inputType : '';
    if (kind && widget.value) {
      return `${kind} · ${widget.value}`;
    }
    return kind || widget.value || undefined;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'input' }>>;

import type { PageWidget } from '@vanstack/xml';
import { applyCommon, cloneItemField, cloneShared } from './common';
import type { WidgetHelperInterface } from './types';

export const textHelper = {
  type: 'text',
  nameKey: 'lowcode.defaultText',
  container: false,
  allowRoot: true,
  accepts: 'none',
  create(ctx) {
    return { type: 'text', id: ctx.id, value: ctx.t('lowcode.defaultText') };
  },
  clone(widget, ctx) {
    return {
      type: 'text',
      id: ctx.nextId(),
      value: widget.value,
      ...cloneShared(widget, ctx.stateIdMap),
      ...cloneItemField(widget),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if (patch.value != null) {
      next.value = patch.value;
    }
    return next;
  },
  treeSuffix(widget) {
    return widget.value;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'text' }>>;

import type { PageWidget } from '@vanstack/xml';
import { applyCommon, cloneItemField, cloneShared } from './common';
import type { WidgetHelperInterface } from './types';

export const buttonHelper = {
  type: 'button',
  nameKey: 'lowcode.defaultButton',
  container: false,
  allowRoot: true,
  accepts: 'none',
  create(ctx) {
    return {
      type: 'button',
      id: ctx.id,
      text: ctx.t('lowcode.defaultButton'),
      style: { background: '#ffffff' },
    };
  },
  clone(widget, ctx) {
    return {
      type: 'button',
      id: ctx.nextId(),
      text: widget.text,
      ...cloneShared(widget, ctx.stateIdMap),
      ...cloneItemField(widget),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if (patch.text != null) {
      next.text = patch.text;
    }
    return next;
  },
  treeSuffix(widget) {
    return widget.text;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'button' }>>;

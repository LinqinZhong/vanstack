import { compactComponentArgs, type PageWidget } from '@vanstack/xml';
import { applyCommon, cloneItemField, cloneShared } from './common';
import type { WidgetHelperInterface } from './types';

export const componentHelper = {
  type: 'component',
  nameKey: 'lowcode.components',
  container: false,
  allowRoot: true,
  accepts: 'none',
  create(ctx) {
    return {
      type: 'component',
      id: ctx.id,
      componentId: '',
      componentKey: '',
      name: ctx.t('lowcode.components'),
    };
  },
  clone(widget, ctx) {
    return {
      type: 'component',
      id: ctx.nextId(),
      componentId: widget.componentId,
      componentKey: widget.componentKey,
      name: widget.name,
      ...(widget.args ? { args: { ...widget.args } } : {}),
      ...cloneShared(widget, ctx.stateIdMap),
      ...cloneItemField(widget),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if ('args' in patch) {
      const args = compactComponentArgs(patch.args);
      if (args) {
        next.args = args;
      } else {
        delete next.args;
      }
    }
    return next;
  },
  treeSuffix(widget) {
    return widget.name || widget.componentKey;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'component' }>>;

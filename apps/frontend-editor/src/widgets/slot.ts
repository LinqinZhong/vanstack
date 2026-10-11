import type { PageWidget } from '@vanstack/xml';
import { applyCommon, cloneChildren, cloneItemField, cloneShared } from './common';
import type { WidgetHelperInterface } from './types';

export const slotHelper = {
  type: 'slot',
  nameKey: 'lowcode.defaultSlot',
  container: true,
  allowRoot: true,
  // 插槽是内容挂载点：定义时不允许有子元素（插槽内容在页面编辑时经 slotContent 注入）。
  accepts: 'none',
  create(ctx) {
    return { type: 'slot', id: ctx.id, slotId: '', children: [] };
  },
  clone(widget, ctx) {
    return {
      type: 'slot',
      id: ctx.nextId(),
      slotId: widget.slotId,
      ...(widget.desc ? { desc: widget.desc } : {}),
      children: cloneChildren(widget, ctx),
      ...cloneShared(widget, ctx.stateIdMap),
      ...cloneItemField(widget),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if ('slotId' in patch) {
      next.slotId = patch.slotId?.trim() ?? '';
    }
    if ('desc' in patch) {
      const desc = patch.desc?.trim();
      if (desc) {
        next.desc = desc;
      } else {
        delete next.desc;
      }
    }
    return next;
  },
  treeSuffix(widget) {
    return widget.desc || undefined;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'slot' }>>;

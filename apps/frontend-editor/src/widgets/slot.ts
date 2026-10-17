import type { PageWidget } from '@vanstack/xml';
import { applyCommon, cloneChildren, cloneItemField, cloneShared } from './common';
import type { WidgetHelperInterface } from './types';

export const slotHelper = {
  type: 'slot',
  nameKey: 'lowcode.defaultSlot',
  container: true,
  allowRoot: true,
  // 插槽内容在页面编辑时经 slotContent 注入；组件定义期的子元素仅作为「调试节点」，
  // 通过组件定义编辑器的「编辑调试节点」入口添加，组件被使用时会被剔除。
  accepts: 'content',
  create(ctx) {
    return { type: 'slot', id: ctx.id, slotId: '', children: [] };
  },
  clone(widget, ctx) {
    return {
      type: 'slot',
      id: ctx.nextId(),
      slotId: widget.slotId,
      ...(widget.name ? { name: widget.name } : {}),
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
    if ('name' in patch) {
      const name = patch.name?.trim();
      if (name) {
        next.name = name;
      } else {
        delete next.name;
      }
    }
    return next;
  },
  treeSuffix(widget) {
    return widget.name || undefined;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'slot' }>>;
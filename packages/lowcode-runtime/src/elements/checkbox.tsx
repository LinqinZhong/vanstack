import { useEffect, useState, type ReactElement } from 'react';
import {
  bindingToString,
  checkboxBoundSelected,
  isCopyBinding,
  propModelName,
  resolveCopyBinding,
  resolveCopyValue,
  type PageWidget,
} from '@vanstack/xml';

function sameOption(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (left == null || right == null || (typeof left !== 'object' && typeof right !== 'object')) {
    return false;
  }
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function optionText(value: unknown): string {
  return bindingToString(value);
}
import { dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, presenceCss, widgetClassName } from '../css';
import { chainEventProps, rememberWidgetValue, type WidgetRuntimeBindings } from '../events';
import { readPropList, resolveWidgetCopy, widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

export function renderCheckbox(
  widget: Extract<PageWidget, { type: 'checkbox' }>,
  ctx: WidgetRenderContext,
  eventHandlers?: WidgetRuntimeBindings['dom'],
): ReactElement {
  return <CheckboxField widget={widget} ctx={ctx} eventHandlers={eventHandlers} />;
}

function CheckboxField({
  widget,
  ctx,
  eventHandlers,
}: {
  widget: Extract<PageWidget, { type: 'checkbox' }>;
  ctx: WidgetRenderContext;
  eventHandlers?: WidgetRuntimeBindings['dom'];
}) {
  const selectedName = widget.selected?.trim() ?? '';
  const propName = propModelName(selectedName);
  const bound = propName
    ? readPropList(ctx.bindingScope.props?.[propName])
    : selectedName
      ? checkboxBoundSelected(widget, ctx.pageData, ctx.modelOverrides)
      : null;
  const optionValue =
    ctx.evaluateBindings && isCopyBinding(widget.value ?? '')
      ? resolveCopyValue(widget.value ?? '', ctx.bindingScope)
      : (widget.value ?? '');
  const checkedText =
    typeof widget.checked === 'string'
      ? ctx.evaluateBindings && isCopyBinding(widget.checked)
        ? resolveCopyBinding(widget.checked, ctx.bindingScope)
        : widget.checked
      : widget.checked
        ? 'true'
        : 'false';
  const source = bound != null ? bound.some((item) => sameOption(item, optionValue)) : checkedText === 'true' || checkedText === '1';
  const [draft, setDraft] = useState(source);
  useEffect(() => {
    setDraft(source);
  }, [source]);

  const displayed = bound != null || ctx.editing ? source : draft;
  rememberWidgetValue(widget.id, displayed ? optionText(optionValue) : '');
  const label = widget.text ? resolveWidgetCopy(widget.text, ctx) : '';
  const { onClick, onChange, ...restHandlers } = eventHandlers ?? {};

  function toggle(event: { preventDefault: () => void }) {
    onClick?.(event);
    if (ctx.editing) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const next = !displayed;
    if (bound != null && selectedName) {
      const nextList = next
        ? bound.some((item) => sameOption(item, optionValue))
          ? bound
          : [...bound, optionValue]
        : bound.filter((item) => !sameOption(item, optionValue));
      ctx.commitModelValue?.(selectedName, JSON.stringify(nextList), true);
    } else {
      setDraft(next);
    }
    onChange?.({
      target: { type: 'checkbox', checked: next, value: next ? optionValue : '' },
    });
  }

  const shared = {
    className: `lowcode-checkbox ${widgetClassName(widget.id)}`,
    'data-widget-id': widget.id,
    'data-widget-type': 'checkbox' as const,
    'data-model-name': selectedName || undefined,
    'data-state': widgetStateAttr(widget, ctx),
    style: mergeCss(
      dynamicStyleCss(widget.style, widgetCssOptions(ctx)),
      flexItemCss(widget.item, widgetCssOptions(ctx)),
      hiddenCss(widget.hidden, ctx.editing),
      presenceCss(widget, widgetCssOptions(ctx)),
    ),
    onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
    onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    onClick: toggle,
  };

  return (
    <label {...chainEventProps(shared, restHandlers)}>
      <input className="lowcode-checkbox-control" type="checkbox" checked={displayed} readOnly tabIndex={-1} />
      <span className="lowcode-checkbox-mark" />
      {label ? <span className="lowcode-checkbox-label">{label}</span> : null}
    </label>
  );
}

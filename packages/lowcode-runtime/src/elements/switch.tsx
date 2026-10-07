import { useEffect, useState, type ReactElement } from 'react';
import { isCopyBinding, propModelName, resolveCopyBinding, switchBoundOn, type PageWidget } from '@vanstack/xml';
import { dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, presenceCss, widgetClassName } from '../css';
import { chainEventProps, rememberWidgetValue, type WidgetRuntimeBindings } from '../events';
import { readPropFlag, widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

export function renderSwitch(
  widget: Extract<PageWidget, { type: 'switch' }>,
  ctx: WidgetRenderContext,
  eventHandlers?: WidgetRuntimeBindings['dom'],
): ReactElement {
  return <SwitchField widget={widget} ctx={ctx} eventHandlers={eventHandlers} />;
}

function SwitchField({
  widget,
  ctx,
  eventHandlers,
}: {
  widget: Extract<PageWidget, { type: 'switch' }>;
  ctx: WidgetRenderContext;
  eventHandlers?: WidgetRuntimeBindings['dom'];
}) {
  const modelName = widget.modelValue?.trim() ?? '';
  const propName = propModelName(modelName);
  const propOn = propName ? readPropFlag(ctx.bindingScope.props?.[propName]) : null;
  const bound = propName ? propOn : modelName ? switchBoundOn(widget, ctx.pageData, ctx.modelOverrides) : null;
  const literal =
    typeof widget.value === 'string'
      ? ctx.evaluateBindings && isCopyBinding(widget.value)
        ? resolveCopyBinding(widget.value, ctx.bindingScope) === 'true' ||
          resolveCopyBinding(widget.value, ctx.bindingScope) === '1'
        : widget.value === 'true' || widget.value === '1'
      : widget.value;
  const source = bound ?? literal;
  const [draft, setDraft] = useState(source);
  useEffect(() => {
    setDraft(source);
  }, [source]);

  const displayed = bound != null || ctx.editing ? source : draft;
  rememberWidgetValue(widget.id, displayed ? 'true' : 'false');
  const { onClick, onChange, ...restHandlers } = eventHandlers ?? {};

  function toggle(event: { preventDefault: () => void }) {
    onClick?.(event);
    if (ctx.editing) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const next = !displayed;
    if (bound != null && modelName) {
      ctx.commitModelValue?.(modelName, next ? '1' : '0', true);
    } else {
      setDraft(next);
    }
    onChange?.({ target: { type: 'switch', checked: next, value: next ? 'true' : 'false' } });
  }

  const shared = {
    type: 'button' as const,
    className: `lowcode-switch${displayed ? ' is-on' : ''} ${widgetClassName(widget.id)}`,
    'data-widget-id': widget.id,
    'data-widget-type': 'switch' as const,
    'data-model-name': modelName || undefined,
    'data-state': widgetStateAttr(widget, ctx),
    'aria-pressed': displayed,
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
    <button {...chainEventProps(shared, restHandlers)}>
      <span className="lowcode-switch-thumb" />
    </button>
  );
}

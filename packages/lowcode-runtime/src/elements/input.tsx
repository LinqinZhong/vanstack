import { useEffect, useState, type ReactElement } from 'react';
import { inputBoundText, isCopyBinding, propModelName, resolveCopyBinding, type PageWidget } from '@vanstack/xml';
import { dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, widgetClassName } from '../css';
import { chainEventProps, rememberWidgetValue } from '../events';
import { readPropText, resolveWidgetCopy, widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

function inputKind(
  widget: Extract<PageWidget, { type: 'input' }>,
  ctx: WidgetRenderContext,
): 'text' | 'password' | 'textarea' | 'number' {
  const raw =
    widget.inputType && ctx.evaluateBindings && isCopyBinding(widget.inputType)
      ? resolveCopyBinding(widget.inputType, ctx.bindingScope)
      : widget.inputType;
  if (raw === 'password' || raw === 'textarea' || raw === 'number') {
    return raw;
  }
  return 'text';
}

export function renderInput(
  widget: Extract<PageWidget, { type: 'input' }>,
  ctx: WidgetRenderContext,
  eventHandlers?: Record<string, (...args: unknown[]) => void>,
): ReactElement {
  return <InputField widget={widget} ctx={ctx} eventHandlers={eventHandlers} />;
}

function InputField({
  widget,
  ctx,
  eventHandlers,
}: {
  widget: Extract<PageWidget, { type: 'input' }>;
  ctx: WidgetRenderContext;
  eventHandlers?: Record<string, (...args: unknown[]) => void>;
}) {
  const modelName = widget.modelValue?.trim() ?? '';
  const propName = propModelName(modelName);
  const propValue = propName ? readPropText(ctx.bindingScope.props?.[propName]) : null;
  const bound = propName ? propValue : modelName ? inputBoundText(widget, ctx.pageData, ctx.modelOverrides) : null;
  const source = bound ?? resolveWidgetCopy(widget.value, ctx);
  const [draft, setDraft] = useState(source);
  useEffect(() => {
    setDraft(source);
  }, [source]);

  const kind = inputKind(widget, ctx);
  const displayed = bound != null || ctx.editing ? source : draft;
  rememberWidgetValue(widget.id, displayed);
  const locked = ctx.editing && bound == null;
  const shared = {
    className: `lowcode-input ${widgetClassName(widget.id)}`,
    'data-widget-id': widget.id,
    'data-widget-type': 'input' as const,
    'data-input-type': kind,
    'data-model-name': modelName || undefined,
    'data-state': widgetStateAttr(widget, ctx),
    style: mergeCss(
      dynamicStyleCss(widget.style, widgetCssOptions(ctx)),
      flexItemCss(widget.item, widgetCssOptions(ctx)),
      hiddenCss(widget.hidden, ctx.editing),
    ),
    placeholder: widget.placeholder ? resolveWidgetCopy(widget.placeholder, ctx) : undefined,
    value: displayed,
    readOnly: locked || undefined,
    tabIndex: locked ? -1 : undefined,
    onMouseDown: locked ? (event: { preventDefault: () => void }) => event.preventDefault() : undefined,
    onChange: (event: { target: { value: string } }) => {
      if (bound != null && modelName) {
        ctx.commitModelValue?.(modelName, event.target.value);
        return;
      }
      if (!ctx.editing) {
        setDraft(event.target.value);
      }
    },
    onBlur: (event: { target: { value: string } }) => {
      if (bound != null && modelName) {
        ctx.commitModelValue?.(modelName, event.target.value, true);
      }
    },
    onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
    onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
  };
  const props = chainEventProps(shared, eventHandlers);

  if (kind === 'textarea') {
    return <textarea {...props} />;
  }
  return <input {...props} type={kind === 'password' ? 'password' : kind === 'number' ? 'number' : 'text'} />;
}

import { Button, Input, Modal, Select, Typography, message } from 'antd';
import { ScriptEditor } from './ScriptEditor';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_LOOP_INDEX,
  DEFAULT_LOOP_ITEM,
  compactLoop,
  type ComponentProp,
  type PageVariable,
  type PageWidget,
  type WidgetLoop,
  type WidgetLoopFrom,
} from '@vanstack/xml';
import { buildPageDataScope, parseReturnExpression, validateDataLiteral } from '../utils/pageData';
import { createPageDataEditorExtensions } from '../utils/pageDataEditor';

type LoopDraft = {
  from: WidgetLoopFrom;
  source: string;
  key: string;
  item: string;
  index: string;
};

function draftFromLoop(loop: WidgetLoop | undefined): LoopDraft {
  return {
    from: loop?.from === 'literal' ? 'literal' : 'data',
    source: loop?.source ?? '',
    key: loop?.key ?? '',
    item: loop?.item ?? DEFAULT_LOOP_ITEM,
    index: loop?.index ?? DEFAULT_LOOP_INDEX,
  };
}

export function WidgetLoopPanel({
  widget,
  variables,
  props = [],
  disabled,
  popupContainer,
  onChange,
}: {
  widget: PageWidget;
  variables: PageVariable[];
  props?: ComponentProp[];
  disabled?: boolean;
  popupContainer?: () => HTMLElement;
  onChange: (loop: WidgetLoop | undefined) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => draftFromLoop(widget.loop));
  const [editing, setEditing] = useState(false);
  const [literalDraft, setLiteralDraft] = useState('return []');
  const widgetIdRef = useRef(widget.id);

  const arrayVariables = useMemo(
    () => variables.filter((variable) => variable.type === 'arr'),
    [variables],
  );
  const arrayProps = useMemo(() => props.filter((prop) => prop.type === 'arr'), [props]);
  const sourceOptions = useMemo(() => {
    const groups = [];
    if (arrayVariables.length > 0) {
      groups.push({
        label: t('lowcode.dataSection'),
        options: arrayVariables.map((variable) => ({ value: `data:${variable.name}`, label: variable.name })),
      });
    }
    if (arrayProps.length > 0) {
      groups.push({
        label: t('lowcode.propsTitle'),
        options: arrayProps.map((prop) => ({ value: `props:${prop.name}`, label: prop.name })),
      });
    }
    return groups;
  }, [arrayProps, arrayVariables, t]);
  const knownNames = useMemo(() => variables.map((variable) => variable.name), [variables]);
  const editorExtensions = useMemo(
    () => createPageDataEditorExtensions(knownNames, t('lowcode.dataUnknownRef')),
    [knownNames, t],
  );

  useEffect(() => {
    if (widgetIdRef.current !== widget.id) {
      widgetIdRef.current = widget.id;
      setDraft(draftFromLoop(widget.loop));
      setEditing(false);
      return;
    }
    setDraft((prev) => {
      const prevCompact = compactLoop(prev);
      const nextCompact = compactLoop(widget.loop);
      if (JSON.stringify(prevCompact) === JSON.stringify(nextCompact)) {
        return prev;
      }
      return draftFromLoop(widget.loop);
    });
  }, [widget.id, widget.loop]);

  function commit(next: LoopDraft) {
    setDraft(next);
    if (disabled) {
      return;
    }
    onChange(
      compactLoop({
        from: next.from,
        source: next.source,
        key: next.key,
        item: next.item,
        index: next.index,
      }),
    );
  }

  function openLiteralEditor() {
    setLiteralDraft(`return ${draft.source.trim() || '[]'}`);
    setEditing(true);
  }

  function confirmLiteral() {
    const expr = parseReturnExpression(literalDraft);
    const scope = buildPageDataScope(variables);
    if (!expr || !validateDataLiteral(expr, 'arr', scope)) {
      message.error(t('lowcode.dataInvalidLiteral'));
      return;
    }
    commit({ ...draft, source: expr });
    setEditing(false);
  }

  function clearLoop() {
    Modal.confirm({
      title: t('lowcode.loopClearConfirm'),
      okText: t('lowcode.loopClear'),
      okButtonProps: { danger: true },
      onOk: () => {
        const empty = draftFromLoop(undefined);
        setDraft(empty);
        if (!disabled) {
          onChange(undefined);
        }
      },
    });
  }

  const canClear = Boolean(draft.source.trim() || draft.key.trim() || compactLoop(widget.loop));

  return (
    <div className="widget-loop-panel">
      <div className="widget-loop-row">
        <span className="widget-loop-label">{t('lowcode.loopSource')}</span>
        <div className="widget-loop-source">
          <Select
            size="small"
            className="widget-loop-from"
            disabled={disabled}
            value={draft.from === 'literal' ? 'literal' : 'data'}
            popupMatchSelectWidth={false}
            getPopupContainer={popupContainer}
            onChange={(from: WidgetLoopFrom) => {
              if (from === 'literal') {
                commit({ ...draft, from, source: '' });
                return;
              }
              if (draft.from === 'literal') {
                commit({ ...draft, from: 'data', source: '' });
              }
            }}
            options={[
              { value: 'literal', label: t('lowcode.loopFromLiteral') },
              { value: 'data', label: t('lowcode.loopFromData') },
            ]}
          />
          {draft.from === 'literal' ? (
            <Button size="small" disabled={disabled} onClick={openLiteralEditor}>
              {t('lowcode.loopEditLiteral')}
            </Button>
          ) : (
            <Select
              size="small"
              className="widget-loop-var"
              allowClear
              disabled={disabled}
              value={draft.source ? `${draft.from}:${draft.source}` : undefined}
              placeholder={t('lowcode.loopSelectVariable')}
              popupMatchSelectWidth={false}
              getPopupContainer={popupContainer}
              onChange={(source) => {
                const picked = typeof source === 'string' ? source : '';
                const splitAt = picked.indexOf(':');
                const from = splitAt > 0 ? picked.slice(0, splitAt) : 'data';
                const name = splitAt > 0 ? picked.slice(splitAt + 1) : '';
                commit({
                  ...draft,
                  from: from === 'props' ? 'props' : 'data',
                  source: name,
                });
              }}
              options={sourceOptions}
            />
          )}
        </div>
      </div>
      <div className="widget-loop-row">
        <span className="widget-loop-label">{t('lowcode.loopKey')}</span>
        <Input
          size="small"
          disabled={disabled}
          value={draft.key}
          onChange={(event) => commit({ ...draft, key: event.target.value })}
        />
      </div>
      <div className="widget-loop-row">
        <span className="widget-loop-label">{t('lowcode.loopIndex')}</span>
        <Input
          size="small"
          disabled={disabled}
          value={draft.index}
          placeholder={DEFAULT_LOOP_INDEX}
          onChange={(event) => commit({ ...draft, index: event.target.value })}
        />
      </div>
      <div className="widget-loop-row">
        <span className="widget-loop-label">{t('lowcode.loopItem')}</span>
        <Input
          size="small"
          disabled={disabled}
          value={draft.item}
          placeholder={DEFAULT_LOOP_ITEM}
          onChange={(event) => commit({ ...draft, item: event.target.value })}
        />
      </div>
      <Button size="small" danger disabled={disabled || !canClear} onClick={clearLoop}>
        {t('lowcode.loopClear')}
      </Button>
      <Modal
        title={t('lowcode.loopEditTitle')}
        open={editing}
        onCancel={() => setEditing(false)}
        onOk={confirmLiteral}
        okButtonProps={{ disabled }}
        destroyOnHidden
      >
        <ScriptEditor
          value={literalDraft}
          height="200px"
          prefix="function loop(){"
          suffix="}"
          extensions={editorExtensions}
          editable={!disabled}
          onChange={setLiteralDraft}
        />
        <Typography.Text type="secondary" className="page-data-hint">
          {t('lowcode.dataScopeHint')}
        </Typography.Text>
      </Modal>
    </div>
  );
}

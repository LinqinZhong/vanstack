import { Button, Input, Modal, Select, Typography, message } from 'antd';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_LOOP_INDEX,
  DEFAULT_LOOP_ITEM,
  compactLoop,
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
  disabled,
  popupContainer,
  onChange,
}: {
  widget: PageWidget;
  variables: PageVariable[];
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
            value={draft.from}
            popupMatchSelectWidth={false}
            getPopupContainer={popupContainer}
            onChange={(from: WidgetLoopFrom) => commit({ ...draft, from, source: '' })}
            options={[
              { value: 'literal', label: t('lowcode.loopFromLiteral') },
              { value: 'data', label: t('lowcode.loopFromData') },
            ]}
          />
          {draft.from === 'data' ? (
            <Select
              size="small"
              className="widget-loop-var"
              allowClear
              disabled={disabled}
              value={draft.source || undefined}
              placeholder={t('lowcode.loopSelectVariable')}
              popupMatchSelectWidth={false}
              getPopupContainer={popupContainer}
              onChange={(source) => commit({ ...draft, source: source ?? '' })}
              options={arrayVariables.map((variable) => ({
                value: variable.name,
                label: variable.name,
              }))}
            />
          ) : (
            <Button size="small" disabled={disabled} onClick={openLiteralEditor}>
              {t('lowcode.loopEditLiteral')}
            </Button>
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
        <div className="page-data-code">
          <pre className="page-data-code-line">{'function loop(){'}</pre>
          <CodeMirror
            value={literalDraft}
            height="180px"
            theme={oneDark}
            extensions={editorExtensions}
            editable={!disabled}
            basicSetup={{ lineNumbers: false, foldGutter: false, autocompletion: false }}
            onChange={setLiteralDraft}
          />
          <pre className="page-data-code-line">{'}'}</pre>
          <Typography.Text type="secondary" className="page-data-hint">
            {t('lowcode.dataScopeHint')}
          </Typography.Text>
        </div>
      </Modal>
    </div>
  );
}

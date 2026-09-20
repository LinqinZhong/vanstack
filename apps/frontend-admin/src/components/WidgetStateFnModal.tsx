import { Modal, Typography, message } from 'antd';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { compactStateFn, type PageVariable, type PageWidget, type WidgetStateDelta } from '@vanstack/xml';
import { createPageDataEditorExtensions } from '../utils/pageDataEditor';

async function copyText(text: string, successMessage: string, failureMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    message.success(successMessage);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      message.success(successMessage);
    } catch {
      message.error(failureMessage);
    }
    document.body.removeChild(textarea);
  }
}

export function WidgetStateFnModal({
  open,
  widget,
  variables,
  disabled,
  onCancel,
  onChange,
}: {
  open: boolean;
  widget: PageWidget;
  variables: PageVariable[];
  disabled?: boolean;
  onCancel: () => void;
  onChange: (stateFn: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(widget.stateFn ?? '');
  const knownNames = useMemo(() => variables.map((variable) => variable.name), [variables]);
  const stateIds = useMemo(() => {
    const seen = new Set<string>();
    const rows: Array<{ id: string; name: string }> = [];
    const nested: WidgetStateDelta[] = (widget.stateOverrides ?? []).flatMap((item) => item.states ?? []);
    const all = [...(widget.states ?? []), ...nested];
    for (const state of all) {
      if (seen.has(state.id)) {
        continue;
      }
      seen.add(state.id);
      rows.push({ id: state.id, name: state.name ?? state.id });
    }
    return rows;
  }, [widget]);
  const editorExtensions = useMemo(
    () => createPageDataEditorExtensions(knownNames, t('lowcode.dataUnknownRef')),
    [knownNames, t],
  );

  useEffect(() => {
    if (open) {
      setDraft(widget.stateFn ?? '');
    }
  }, [open, widget.id, widget.stateFn]);

  function confirm() {
    const body = compactStateFn(draft);
    if (body) {
      try {
        new Function('$data', '$item', '$index', `"use strict";\n${body}`);
      } catch {
        message.error(t('lowcode.stateFnInvalid'));
        return;
      }
    }
    onChange(body);
  }

  return (
    <Modal
      title={t('lowcode.stateFnTitle')}
      open={open}
      onCancel={onCancel}
      onOk={confirm}
      okButtonProps={{ disabled }}
      destroyOnHidden
    >
      <div className="page-data-code">
        <pre className="page-data-code-line">{'function state(): string{'}</pre>
        <CodeMirror
          value={draft}
          height="180px"
          theme={oneDark}
          extensions={editorExtensions}
          editable={!disabled}
          basicSetup={{ lineNumbers: false, foldGutter: false, autocompletion: false }}
          onChange={setDraft}
        />
        <pre className="page-data-code-line">{'}'}</pre>
        {stateIds.length ? (
          <div className="state-fn-id-list">
            <Typography.Text type="secondary" className="state-fn-id-list-label">
              {t('lowcode.stateFnAvailableIds')}
            </Typography.Text>
            <div className="state-fn-id-chips">
              {stateIds.map((state) => (
                <button
                  key={state.id}
                  type="button"
                  className="state-fn-id-chip"
                  title={t('lowcode.stateCopyId')}
                  disabled={disabled}
                  onClick={() =>
                    void copyText(state.id, t('lowcode.stateIdCopied'), t('lowcode.stateIdCopyFailed'))
                  }
                >
                  <span className="state-fn-id-chip-name">{state.name}</span>
                  <span className="state-fn-id-chip-value">{state.id}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <Typography.Text type="secondary" className="page-data-hint">
          {t('lowcode.stateFnHint')}
        </Typography.Text>
      </div>
    </Modal>
  );
}

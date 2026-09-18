import { Modal, Typography, message } from 'antd';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { compactStateFn, type PageVariable, type PageWidget } from '@vanstack/xml';
import { createPageDataEditorExtensions } from '../utils/pageDataEditor';

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
        <Typography.Text type="secondary" className="page-data-hint">
          {t('lowcode.stateFnHint')}
        </Typography.Text>
      </div>
    </Modal>
  );
}

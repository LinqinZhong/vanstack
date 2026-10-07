import { Form, Modal, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { compactStateFn, type ComponentProp, type PageVariable, type PageWidget } from '@vanstack/xml';
import { createPageDataEditorExtensions } from '../utils/pageDataEditor';
import { ScriptEditor } from './ScriptEditor';

export type WidgetPresenceDraft = {
  existsFn?: string;
  displayFn?: string;
  visibleFn?: string;
};

const FIELDS = [
  { key: 'existsFn', prefix: 'function isExists(){', label: 'presenceExists', hint: 'presenceExistsHint' },
  { key: 'displayFn', prefix: 'function isDisplay(){', label: 'presenceDisplay', hint: 'presenceDisplayHint' },
  { key: 'visibleFn', prefix: 'function isVisiabled(){', label: 'presenceVisible', hint: 'presenceVisibleHint' },
] as const;

export function WidgetPresenceModal({
  open,
  widget,
  variables,
  props = [],
  disabled,
  onCancel,
  onChange,
}: {
  open: boolean;
  widget: PageWidget;
  variables: PageVariable[];
  props?: ComponentProp[];
  disabled?: boolean;
  onCancel: () => void;
  onChange: (next: WidgetPresenceDraft) => void;
}) {
  const { t } = useTranslation();
  const [existsFn, setExistsFn] = useState(widget.existsFn ?? '');
  const [displayFn, setDisplayFn] = useState(widget.displayFn ?? '');
  const [visibleFn, setVisibleFn] = useState(widget.visibleFn ?? '');
  const knownNames = useMemo(() => variables.map((variable) => variable.name), [variables]);
  const propNames = useMemo(() => props.map((prop) => prop.name), [props]);
  const editorExtensions = useMemo(
    () => createPageDataEditorExtensions(knownNames, t('lowcode.dataUnknownRef'), propNames),
    [knownNames, propNames, t],
  );
  const drafts = { existsFn, displayFn, visibleFn };

  useEffect(() => {
    if (open) {
      setExistsFn(widget.existsFn ?? '');
      setDisplayFn(widget.displayFn ?? '');
      setVisibleFn(widget.visibleFn ?? '');
    }
  }, [open, widget.id, widget.existsFn, widget.displayFn, widget.visibleFn]);

  function confirm() {
    const next: WidgetPresenceDraft = {};
    for (const field of FIELDS) {
      const body = compactStateFn(drafts[field.key]);
      if (body) {
        try {
          new Function('$data', '$item', '$index', '$props', '$query', `"use strict";\n${body}`);
        } catch {
          message.error(t('lowcode.presenceInvalid', { name: t(`lowcode.${field.label}`) }));
          return;
        }
      }
      next[field.key] = body;
    }
    onChange(next);
  }

  return (
    <Modal
      title={t('lowcode.presenceTitle')}
      open={open}
      onCancel={onCancel}
      onOk={confirm}
      okButtonProps={{ disabled }}
      width={640}
      destroyOnHidden
    >
      <Form className="state-fn-form" layout="vertical" colon={false}>
        {FIELDS.map((field) => (
          <Form.Item
            key={field.key}
            label={t(`lowcode.${field.label}`)}
            extra={t(`lowcode.${field.hint}`)}
            className="state-fn-code-item"
          >
            <ScriptEditor
              value={drafts[field.key]}
              height="96px"
              prefix={field.prefix}
              suffix="}"
              extensions={editorExtensions}
              editable={!disabled}
              onChange={(value) => {
                if (field.key === 'existsFn') setExistsFn(value);
                else if (field.key === 'displayFn') setDisplayFn(value);
                else setVisibleFn(value);
              }}
            />
          </Form.Item>
        ))}
      </Form>
      <Typography.Text type="secondary" className="page-data-hint">
        {t('lowcode.presenceHint')}
      </Typography.Text>
    </Modal>
  );
}

import { Button, Input, InputNumber, Modal, Switch, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDataLiteral, tryParseDataLiteral } from '../utils/dataLiteral';

/**
 * 组件入参/插槽出参表格里的「值」单元格编辑器，交互与数据面板保持一致：
 * num → 数字输入；str/icon/image → 文本；bool → 开关；arr/obj → 弹窗编辑 JSON。
 */
export function PropValueEditor({
  type,
  value,
  disabled,
  onChange,
  onEndCoalesce,
}: {
  type: string;
  value: string;
  disabled?: boolean;
  onChange: (next: string) => void;
  onEndCoalesce?: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');

  if (type === 'num') {
    return (
      <InputNumber
        size="small"
        style={{ width: '100%' }}
        disabled={disabled}
        value={value === '' ? null : Number(value)}
        onChange={(next) => onChange(String(next ?? 0))}
        onBlur={onEndCoalesce}
      />
    );
  }
  if (type === 'bool') {
    return (
      <Switch
        size="small"
        disabled={disabled}
        checked={value === '1'}
        onChange={(checked) => onChange(checked ? '1' : '0')}
      />
    );
  }
  if (type === 'str' || type === 'icon' || type === 'image') {
    return (
      <Input
        size="small"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onEndCoalesce}
        onPressEnter={(event) => (event.target as HTMLInputElement).blur()}
      />
    );
  }

  const isArr = type === 'arr';
  const openEditor = () => {
    const parsed = tryParseDataLiteral(value);
    if (parsed != null) {
      setDraft(JSON.stringify(parsed, null, 2));
    } else {
      setDraft(isArr ? '[]' : '{}');
    }
    setOpen(true);
  };
  const confirm = () => {
    const parsed = tryParseDataLiteral(draft);
    if (isArr ? !Array.isArray(parsed) : !parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return;
    }
    onChange(formatDataLiteral(parsed, 0));
    onEndCoalesce?.();
    setOpen(false);
  };

  return (
    <div className="page-data-value-row">
      <Typography.Text ellipsis={{ tooltip: value }} className="page-data-preview">
        {value}
      </Typography.Text>
      <Button size="small" disabled={disabled} onClick={openEditor}>
        {t('lowcode.dataEditValue')}
      </Button>
      <Modal
        title={t('lowcode.dataEditValue')}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={confirm}
        okButtonProps={{ disabled }}
        destroyOnHidden
        width={640}
      >
        <Input.TextArea
          rows={14}
          value={draft}
          disabled={disabled}
          spellCheck={false}
          style={{ fontFamily: 'monospace' }}
          onChange={(event) => setDraft(event.target.value)}
        />
      </Modal>
    </div>
  );
}

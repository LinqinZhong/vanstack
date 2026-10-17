import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Empty, Input, InputNumber, Modal, Segmented, Switch, Tree, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildPropsRecord,
  type ComponentProp,
  type PageDataType,
  type PageVariable,
  type PageWidget,
} from '@vanstack/xml';
import { formatTypeLabel } from './TypeKindFields';
import { ScriptEditor } from './ScriptEditor';
import {
  buildPageDataScope,
  dataEditorDraft,
  dataEditorStored,
  defaultPageDataValue,
  evaluateDataExpression,
  isDataExpression,
  validateDataLiteral,
} from '../utils/pageData';
import { formatDataLiteral, tryParseDataLiteral } from '../utils/dataLiteral';
import { createPageDataEditorExtensions } from '../utils/pageDataEditor';
import { findWidget, toWidgetTreeData, widgetTreeLabel } from '../utils/widgetTree';

/** 内置类型走专属静态控件，其余（命名空间自定义类型）按 JSON 编辑。 */
const BUILTIN_TYPES = ['num', 'str', 'bool', 'arr', 'obj', 'icon', 'image', 'widget'];

/** 表格里的「值」单元格：统一为「预览 + 编辑值按钮」。 */
export function ValueEditCell({
  preview,
  disabled,
  onEdit,
}: {
  preview: string;
  disabled?: boolean;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="page-data-value-row">
      <Typography.Text
        ellipsis={{ tooltip: preview }}
        className={preview ? 'page-data-preview' : 'page-data-preview is-empty'}
      >
        {preview || '—'}
      </Typography.Text>
      <Button size="small" disabled={disabled} onClick={onEdit}>
        {t('lowcode.dataEditValue')}
      </Button>
    </div>
  );
}

export type ValueEditorResult = { value: string; dynamic: boolean; computed: boolean };

/** 把弹窗结果写回一条记录；未开启动态时清理 dynamic/computed。 */
export function applyValueResult<T extends { value: string; dynamic?: boolean; computed?: boolean }>(
  record: T,
  next: ValueEditorResult,
): T {
  const { dynamic: _dynamic, computed: _computed, ...rest } = record;
  return {
    ...rest,
    value: next.value,
    ...(next.dynamic ? { dynamic: true } : {}),
    ...(next.dynamic && next.computed ? { computed: true } : {}),
  } as T;
}

export type ValueEditorProps = {
  open: boolean;
  /** 变量类型：内置类型或命名空间自定义类型名。 */
  type: string;
  of?: string;
  /** 变量/参数名，用于动态表达式的函数体包裹。 */
  name?: string;
  value: string;
  dynamic?: boolean;
  computed?: boolean;
  disabled?: boolean;
  /** 是否允许切换为「动态」表达式。组件入参等一律用静态编辑时传 false。 */
  allowDynamic?: boolean;
  /** 表达式求值作用域。 */
  variables?: PageVariable[];
  index?: number;
  componentProps?: ComponentProp[];
  propNames?: string[];
  queryNames?: string[];
  widgets?: PageWidget[];
  onCancel: () => void;
  onConfirm: (next: ValueEditorResult) => void;
};

export function ValueEditor({
  open,
  type,
  of,
  name,
  value,
  dynamic,
  computed,
  disabled,
  allowDynamic = true,
  variables,
  index,
  componentProps = [],
  propNames = [],
  queryNames = [],
  widgets = [],
  onCancel,
  onConfirm,
}: ValueEditorProps) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<'static' | 'dynamic'>('static');
  const [reactive, setReactive] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftItems, setDraftItems] = useState<unknown[] | null>(null);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [itemEditor, setItemEditor] = useState<{ kind: 'item' | 'add'; index?: number; draft: string } | null>(null);
  const [bulkDraft, setBulkDraft] = useState<string | null>(null);
  const [codeValid, setCodeValid] = useState(true);
  const [bulkValid, setBulkValid] = useState(true);
  const [itemValid, setItemValid] = useState(true);

  const isBuiltin = BUILTIN_TYPES.includes(type);
  const isArr = type === 'arr';
  const isObjLike = type === 'obj' || !isBuiltin;
  const editKey = open ? `${name ?? ''}:${type}:${of ?? ''}:${value}:${dynamic ? 1 : 0}:${computed ? 1 : 0}` : '';

  const knownNames = useMemo(
    () => (variables && index != null ? variables.slice(0, index).map((variable) => variable.name) : []),
    [variables, index],
  );
  const editorExtensions = useMemo(
    () => createPageDataEditorExtensions(knownNames, t('lowcode.dataUnknownRef'), propNames, queryNames),
    [knownNames, propNames, queryNames, t],
  );
  const widgetTreeData = useMemo(
    () => toWidgetTreeData(widgets, (widget) => widgetTreeLabel(widget, t)),
    [widgets, t],
  );

  useEffect(() => {
    if (!open) {
      setDraftItems(null);
      setItemEditor(null);
      setBulkDraft(null);
      return;
    }
    const asDynamic = resolveDynamic();
    setKind(asDynamic ? 'dynamic' : 'static');
    setReactive(Boolean(computed));
    setDirty(false);
    setItemEditor(null);
    setBulkDraft(null);
    setItemsExpanded(false);
    setCodeValid(true);
    if (!asDynamic && isArr) {
      const parsed = tryParseDataLiteral(value);
      setDraftItems(Array.isArray(parsed) ? parsed : []);
      return;
    }
    setDraftItems(null);
    if (!asDynamic && isObjLike) {
      const parsed = tryParseDataLiteral(value);
      if (parsed === undefined) {
        setDraft(type === 'obj' ? '{}' : value);
      } else {
        setDraft(prettyJson(parsed));
      }
      return;
    }
    setDraft(asDynamic ? dataEditorDraft(value, defaultPageDataValue(type as PageDataType)) : value);
    // 只在打开或换一条记录时重读，编辑过程中不跟着回写。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editKey]);

  function resolveDynamic(): boolean {
    if (!allowDynamic) {
      return false;
    }
    if (dynamic || computed) {
      return true;
    }
    if (type !== 'arr' && type !== 'obj') {
      return false;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }
    const parsed = tryParseDataLiteral(trimmed);
    if (type === 'arr' && Array.isArray(parsed)) {
      return false;
    }
    if (type === 'obj' && isPlainRecord(parsed)) {
      return false;
    }
    if (!isDataExpression(trimmed)) {
      return true;
    }
    const props = buildPropsRecord(componentProps);
    const scope = buildPageDataScope(variables, index, props);
    try {
      const result = evaluateDataExpression(trimmed, scope, props);
      return type === 'arr' ? !Array.isArray(result) : !isPlainRecord(result);
    } catch {
      return true;
    }
  }

  function validateExpression(expr: string, scope: Record<string, unknown>, props: Record<string, unknown>): boolean {
    if (!expr) {
      return false;
    }
    if (!isBuiltin) {
      try {
        evaluateDataExpression(expr, scope, props);
        return true;
      } catch {
        return false;
      }
    }
    return validateDataLiteral(expr, type as PageDataType, scope, props);
  }

  function switchKind(next: 'static' | 'dynamic') {
    if (next === kind) {
      return;
    }
    if (next === 'dynamic') {
      const source = isArr ? stringifyItems(draftItems ?? []) ?? '[]' : draft.trim() || (isObjLike ? '{}' : '');
      setDraft(dataEditorDraft(source, defaultPageDataValue(type as PageDataType)));
      setKind('dynamic');
      setDirty(true);
      return;
    }
    const expr = dataEditorStored(draft);
    const props = buildPropsRecord(componentProps);
    const scope = buildPageDataScope(variables, index, props);
    const parsed = expr ? tryParseDataLiteral(expr) : undefined;
    if (isArr && Array.isArray(parsed)) {
      setDraftItems(parsed);
      setReactive(false);
      setKind('static');
      setDirty(true);
      return;
    }
    if (isObjLike && isPlainRecord(parsed)) {
      setDraft(prettyJson(parsed));
      setReactive(false);
      setKind('static');
      setDirty(true);
      return;
    }
    if (!expr || !validateExpression(expr, scope, props)) {
      message.error(t('lowcode.dataInvalidLiteral'));
      return;
    }
    try {
      const result = evaluateDataExpression(expr, scope, props);
      if (isArr) {
        if (!Array.isArray(result)) {
          message.error(t('lowcode.dataInvalidLiteral'));
          return;
        }
        setDraftItems(result);
      } else if (isObjLike) {
        if (!isPlainRecord(result)) {
          message.error(t('lowcode.dataInvalidLiteral'));
          return;
        }
        setDraft(prettyJson(result));
      } else {
        setDraft(staticScalar(result));
      }
    } catch {
      message.error(t('lowcode.dataInvalidLiteral'));
      return;
    }
    setReactive(false);
    setKind('static');
    setDirty(true);
  }

  function staticScalar(result: unknown): string {
    if (type === 'num') {
      const num = Number(result);
      return Number.isFinite(num) ? String(num) : '0';
    }
    if (type === 'bool') {
      return result ? '1' : '0';
    }
    return result == null ? '' : String(result);
  }

  function confirm() {
    if (!dirty) {
      onCancel();
      return;
    }
    if (kind === 'static') {
      if (isArr) {
        const text = stringifyItems(draftItems ?? []);
        if (text == null) {
          message.error(t('lowcode.dataInvalidLiteral'));
          return;
        }
        onConfirm({ value: text, dynamic: false, computed: false });
        return;
      }
      if (isObjLike) {
        const parsed = draft.trim() ? tryParseDataLiteral(draft) : null;
        if (draft.trim() && parsed === undefined) {
          message.error(t('lowcode.dataInvalidLiteral'));
          return;
        }
        if (draft.trim() && type === 'obj' && !isPlainRecord(parsed)) {
          message.error(t('lowcode.dataInvalidLiteral'));
          return;
        }
        onConfirm({ value: draft.trim() ? formatDataLiteral(parsed) : '', dynamic: false, computed: false });
        return;
      }
      onConfirm({ value: staticScalar(draft), dynamic: false, computed: false });
      return;
    }
    const expr = dataEditorStored(draft);
    const props = buildPropsRecord(componentProps);
    const scope = buildPageDataScope(variables, index, props);
    if (!expr || !validateExpression(expr, scope, props)) {
      message.error(t('lowcode.dataInvalidLiteral'));
      return;
    }
    onConfirm({ value: expr, dynamic: true, computed: reactive });
  }

  function confirmItemEditor() {
    if (!itemEditor || !draftItems) {
      return;
    }
    const props = buildPropsRecord(componentProps);
    const scope = buildPageDataScope(variables, index, props);
    let next = tryParseDataLiteral(itemEditor.draft);
    if (next === undefined && itemEditor.draft.trim() !== '') {
      try {
        next = evaluateDataExpression(itemEditor.draft, scope, props);
      } catch {
        message.error(t('lowcode.dataInvalidLiteral'));
        return;
      }
    }
    if (next === undefined && itemEditor.draft.trim() === '') {
      message.error(t('lowcode.dataInvalidLiteral'));
      return;
    }
    setDraftItems(
      itemEditor.kind === 'add'
        ? [...draftItems, next]
        : draftItems.map((item, itemIndex) => (itemIndex === itemEditor.index ? next : item)),
    );
    setDirty(true);
    setItemEditor(null);
  }

  function confirmBulkEditor() {
    if (bulkDraft == null) {
      return;
    }
    const parsed = tryParseDataLiteral(bulkDraft);
    if (!Array.isArray(parsed)) {
      message.error(t('lowcode.dataInvalidLiteral'));
      return;
    }
    setDraftItems(parsed);
    setDirty(true);
    setBulkDraft(null);
  }

  function widgetLabel(id: string): string {
    if (!id) {
      return t('lowcode.dataWidgetEmpty');
    }
    const widget = findWidget(widgets, id);
    return widget ? widgetTreeLabel(widget, t) : t('lowcode.dataWidgetMissing', { id });
  }

  const typeLabel = formatTypeLabel(type, of, (key) => t(`lowcode.propType.${key}`, { defaultValue: key }));

  return (
    <>
      <Modal
        title={t('lowcode.dataEditValue')}
        open={open}
        onCancel={() => {
          setItemEditor(null);
          setBulkDraft(null);
          onCancel();
        }}
        onOk={confirm}
        okButtonProps={{ disabled: disabled || !codeValid }}
        destroyOnHidden
        width={760}
      >
        {allowDynamic ? (
          <div className="page-data-value-options">
            <label className="page-data-value-option">
              <span>{t('lowcode.dataValueKind')}</span>
              <Segmented
                size="small"
                value={kind}
                options={[
                  { label: t('lowcode.dataValueStatic'), value: 'static' },
                  { label: t('lowcode.dataValueDynamic'), value: 'dynamic' },
                ]}
                onChange={(next) => switchKind(next === 'dynamic' ? 'dynamic' : 'static')}
              />
            </label>
            {kind === 'dynamic' ? (
              <label className="page-data-value-option">
                <span>{t('lowcode.dataValueReactive')}</span>
                <Switch
                  size="small"
                  disabled={disabled}
                  checked={reactive}
                  title={t('lowcode.dataComputedHint')}
                  onChange={(checked) => {
                    setReactive(checked);
                    setDirty(true);
                  }}
                />
              </label>
            ) : null}
          </div>
        ) : null}
        {kind === 'dynamic' ? (
          <>
            <ScriptEditor
              value={draft}
              height="240px"
              prefix={`function ${name || 'value'}(){`}
              suffix="}"
              extensions={editorExtensions}
              editable={!disabled}
              onValidateChange={setCodeValid}
              onChange={(next) => {
                setDraft(next);
                setDirty(true);
              }}
            />
            <Typography.Text type="secondary" className="page-data-hint">
              {reactive ? t('lowcode.dataComputedHint') : t('lowcode.dataScopeHint')}
            </Typography.Text>
          </>
        ) : isArr && draftItems ? (
          <ArrayValueEditor
            name={name ?? ''}
            typeLabel={typeLabel}
            items={draftItems}
            expanded={itemsExpanded}
            disabled={disabled}
            onToggle={() => setItemsExpanded((current) => !current)}
            onEdit={(itemIndex) => setItemEditor({ kind: 'item', index: itemIndex, draft: prettyJson(draftItems[itemIndex]) })}
            onDelete={(itemIndex) => {
              setDraftItems(draftItems.filter((_, i) => i !== itemIndex));
              setDirty(true);
            }}
            onAdd={() => setItemEditor({ kind: 'add', draft: 'null' })}
            onEditAll={() => setBulkDraft(prettyJson(draftItems))}
          />
        ) : isObjLike ? (
          <ScriptEditor
            value={draft}
            height="240px"
            editable={!disabled}
            onValidateChange={setCodeValid}
            onChange={(next) => {
              setDraft(next);
              setDirty(true);
            }}
          />
        ) : type === 'bool' ? (
          <Switch
            checked={draft === '1'}
            disabled={disabled}
            onChange={(checked) => {
              setDraft(checked ? '1' : '0');
              setDirty(true);
            }}
          />
        ) : type === 'num' ? (
          <InputNumber
            style={{ width: '100%' }}
            value={draft === '' ? null : Number(draft)}
            disabled={disabled}
            onChange={(next) => {
              setDraft(String(next ?? 0));
              setDirty(true);
            }}
          />
        ) : type === 'widget' ? (
          widgets.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.emptyWidgets')} />
          ) : (
            <Tree
              className="page-data-widget-picker"
              blockNode
              defaultExpandAll
              selectedKeys={draft ? [draft] : []}
              treeData={widgetTreeData}
              onSelect={(keys) => {
                setDraft(keys[0] ? String(keys[0]) : '');
                setDirty(true);
              }}
            />
          )
        ) : (
          <Input
            value={draft}
            disabled={disabled}
            onChange={(event) => {
              setDraft(event.target.value);
              setDirty(true);
            }}
          />
        )}
        {type === 'widget' && draft ? (
          <Typography.Text type="secondary" className="page-data-hint">
            {widgetLabel(draft)}
          </Typography.Text>
        ) : null}
      </Modal>
      <Modal
        title="JSON"
        open={bulkDraft != null}
        onCancel={() => setBulkDraft(null)}
        onOk={confirmBulkEditor}
        okButtonProps={{ disabled: disabled || bulkDraft == null || !bulkValid }}
        destroyOnHidden
        width={640}
      >
        {bulkDraft != null ? (
          <ScriptEditor
            value={bulkDraft}
            height="240px"
            editable={!disabled}
            onValidateChange={setBulkValid}
            onChange={setBulkDraft}
          />
        ) : null}
      </Modal>
      <Modal
        title={itemEditor?.kind === 'add' ? t('lowcode.previewAddItem') : t('lowcode.previewEditItem')}
        open={Boolean(itemEditor)}
        onCancel={() => setItemEditor(null)}
        onOk={confirmItemEditor}
        okButtonProps={{ disabled: disabled || !itemEditor || !itemValid }}
        destroyOnHidden
        width={640}
      >
        {itemEditor ? (
          <ScriptEditor
            value={itemEditor.draft}
            height="240px"
            editable={!disabled}
            onValidateChange={setItemValid}
            onChange={(next) => setItemEditor((current) => (current ? { ...current, draft: next } : current))}
          />
        ) : null}
      </Modal>
    </>
  );
}

function ArrayValueEditor({
  name,
  typeLabel,
  items,
  expanded,
  disabled,
  onToggle,
  onEdit,
  onDelete,
  onAdd,
  onEditAll,
}: {
  name: string;
  typeLabel: string;
  items: unknown[];
  expanded: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onAdd: () => void;
  onEditAll: () => void;
}) {
  const { t } = useTranslation();
  const canFold = items.length > 5;
  const folded = canFold && !expanded;
  const shown = folded ? items.slice(0, 3) : items;
  return (
    <div className="preview-scope-row">
      <div className="preview-scope-name">
        <span>{name}</span>
        <span className="preview-scope-type">{typeLabel}</span>
        <Button
          size="small"
          type="text"
          className="preview-scope-name-action"
          icon={<EditOutlined />}
          disabled={disabled}
          aria-label={t('lowcode.edit')}
          title={t('lowcode.edit')}
          onClick={onEditAll}
        />
      </div>
      <div className="preview-scope-items">
        {shown.map((item, index) => {
          const text = compactJson(item);
          return (
            <div key={`${name}:${index}:${text}`} className="preview-scope-item">
              <span className="preview-scope-literal-text" title={text}>
                {text}
              </span>
              <Button
                size="small"
                type="text"
                icon={<EditOutlined />}
                disabled={disabled}
                aria-label={t('lowcode.edit')}
                title={t('lowcode.edit')}
                onClick={() => onEdit(index)}
              />
              <Button
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={disabled}
                aria-label={t('lowcode.delete')}
                title={t('lowcode.delete')}
                onClick={() => onDelete(index)}
              />
            </div>
          );
        })}
        {canFold ? (
          <Button size="small" type="text" className="preview-scope-fold" onClick={onToggle}>
            {folded ? t('lowcode.previewExpandItems', { count: items.length - 3 }) : t('lowcode.previewCollapseItems')}
          </Button>
        ) : null}
        <Button
          size="small"
          type="text"
          className="preview-scope-add"
          icon={<PlusOutlined />}
          disabled={disabled}
          aria-label={t('lowcode.previewAddItem')}
          title={t('lowcode.previewAddItem')}
          onClick={onAdd}
        />
      </div>
    </div>
  );
}

function stringifyItems(items: unknown[]): string | null {
  try {
    return formatDataLiteral(items);
  } catch {
    return null;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function compactJson(value: unknown) {
  try {
    return formatDataLiteral(value);
  } catch {
    return '';
  }
}

function prettyJson(value: unknown) {
  try {
    return formatDataLiteral(value, 2);
  } catch {
    return '';
  }
}

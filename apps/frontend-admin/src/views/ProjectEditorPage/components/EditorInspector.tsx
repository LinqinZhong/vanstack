import { ConfigProvider, Modal, message } from 'antd';
import { useTranslation } from 'react-i18next';
import type { PageI18n, PageStyle, PageVariable, PageWidget } from '@vanstack/xml';
import { EditorHelpModal } from '../../../components/EditorHelpModal';
import { PagePropertyInspector, WidgetPropertyInspector } from '../../../components/InspectorPropertyGrid';
import { inspectorTheme } from '../../../components/inspectorTheme';
import type { WidgetPatch } from '../../../utils/widgetTree';
import { widgetTypeName } from '../../../utils/widgetTree';
import { CoalesceField } from './CoalesceField';

/**
 * 帮助弹窗和属性检查弹窗。
 * 有选中控件时编辑该控件（页面传入的是叠了当前状态层之后的显示副本）；没有选中时编辑页面样式。
 * 字段校验失败时 invalid 为真：点遮罩和按 Esc 都不能关，点取消只会提示先改对。
 * 输入包在 CoalesceField 里，焦点离开整块检查器才结束这一次合并编辑。
 * onPageStyle 的 field 只是字段名，页面会自己加上 `edit:page:` 前缀再写入撤销键。
 */
type EditorInspectorProps = {
  helpOpen: boolean;
  onHelpClose: () => void;
  open: boolean;
  widget: PageWidget | null;
  parentType?: PageWidget['type'];
  readOnly: boolean;
  pageI18n: PageI18n | undefined;
  variables: PageVariable[];
  projectId: string;
  ownKeys: Set<string> | null | undefined;
  pageStyle: PageStyle | undefined;
  invalid: boolean;
  onInvalidChange: (invalid: boolean) => void;
  onClose: () => void;
  onPatch: (widgetId: string, patch: WidgetPatch, coalesceKey: string) => void;
  onPageStyle: (style: PageStyle | undefined, field: string) => void;
  onLeave: () => void;
};

export function EditorInspector({
  helpOpen,
  onHelpClose,
  open,
  widget,
  parentType,
  readOnly,
  pageI18n,
  variables,
  projectId,
  ownKeys,
  pageStyle,
  invalid,
  onInvalidChange,
  onClose,
  onPatch,
  onPageStyle,
  onLeave,
}: EditorInspectorProps) {
  const { t } = useTranslation();
  return (
    <ConfigProvider theme={inspectorTheme}>
      <EditorHelpModal open={helpOpen} onClose={onHelpClose} />
      <Modal
        className="inspector-modal"
        open={open}
        title={
          widget
            ? t('lowcode.widgetInspectorTitle', {
                type: widgetTypeName(widget.type, t),
                id: widget.id,
              })
            : t('lowcode.pageInspector')
        }
        footer={null}
        width={920}
        // 校验失败时遮罩和 Esc 都不能关，避免带着非法值退出。
        mask={{ closable: !invalid }}
        keyboard={!invalid}
        styles={{ body: { maxHeight: 'none', overflow: 'visible' } }}
        onCancel={() => {
          if (invalid) {
            message.warning(t('lowcode.propInvalidClose'));
            return;
          }
          onClose();
        }}
        destroyOnHidden
      >
        {widget ? (
          <CoalesceField onLeave={onLeave}>
            <WidgetPropertyInspector
              widget={widget}
              parentType={parentType}
              disabled={readOnly}
              i18nCatalog={pageI18n}
              projectId={projectId}
              variables={variables}
              ownKeys={ownKeys ?? undefined}
              onPatch={(patch, coalesceKey) => onPatch(widget.id, patch, coalesceKey)}
              onInvalidChange={onInvalidChange}
            />
          </CoalesceField>
        ) : (
          <CoalesceField onLeave={onLeave}>
            <PagePropertyInspector
              style={pageStyle}
              disabled={readOnly}
              onChange={(style, field) => onPageStyle(style, field)}
              onInvalidChange={onInvalidChange}
            />
          </CoalesceField>
        )}
      </Modal>
    </ConfigProvider>
  );
}

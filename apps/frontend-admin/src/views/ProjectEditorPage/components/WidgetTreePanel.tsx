import {
  CopyOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  PlusOutlined,
  RedoOutlined,
  SnippetsOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Button, Card, Dropdown, Empty, Tooltip, Tree, type TreeDataNode } from 'antd';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { isLoopConfigured, type PageWidget } from '@vanstack/xml';
import { writeWidgetDrag } from '../../../utils/pageData';
import { canMoveWidget, findWidget, type WidgetDropPlacement } from '../../../utils/widgetTree';
import { TreeActionButton } from './TreeActionButton';

/**
 * 组件树：展开、选中、拖拽换层级，以及撤销、重做、复制、粘贴、删除、添加。
 * 拖到某个位置是否合法由 canMoveWidget 决定；不合法的落点不会触发 onMove。
 * 数据面板打开、标题可以拖进变量（canDragWidgetToData）时关掉树内排序，避免两套拖拽抢同一个指针事件。
 * 右键打开别名菜单，循环图标打开循环配置，眼睛切换 hidden。双击通知页面把画布对准该控件。
 */
type WidgetTreePanelProps = {
  widgets: PageWidget[];
  treeData: TreeDataNode[];
  readOnly: boolean;
  canDragWidgetToData: boolean;
  expandedKeys: string[];
  selectedWidgetId: string | null;
  treeHostRef: RefObject<HTMLDivElement | null>;
  modifier: string;
  canUndo: boolean;
  canRedo: boolean;
  canCopy: boolean;
  canPaste: boolean;
  canDelete: boolean;
  addDisabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onAdd: () => void;
  onOpenAlias: (widgetId: string) => void;
  onOpenLoop: (widgetId: string) => void;
  onToggleHidden: (widgetId: string) => void;
  onExpand: (keys: string[]) => void;
  onSelect: (widgetId: string) => void;
  onFocus: (widgetId: string) => void;
  onMove: (dragId: string, dropId: string, placement: WidgetDropPlacement) => void;
};

/**
 * 把 Tree 的落点换算成移动方向。
 * 放在节点上（dropToGap 为假）是 inside，成为该节点的子级。
 * 落在间隙时，dropPosition 比节点在同级中的序号小 1 为 before，否则为 after。
 * 真正改树、展开目标父级、写入撤销仍由页面的 onMove 完成。
 */
function treeDropPlacement(dropToGap: boolean, nodePos: string, dropPosition: number): WidgetDropPlacement {
  if (!dropToGap) {
    return 'inside';
  }
  const offset = dropPosition - Number(nodePos.split('-').at(-1));
  return offset === -1 ? 'before' : 'after';
}

export function WidgetTreePanel({
  widgets,
  treeData,
  readOnly,
  canDragWidgetToData,
  expandedKeys,
  selectedWidgetId,
  treeHostRef,
  modifier,
  canUndo,
  canRedo,
  canCopy,
  canPaste,
  canDelete,
  addDisabled,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onDelete,
  onAdd,
  onOpenAlias,
  onOpenLoop,
  onToggleHidden,
  onExpand,
  onSelect,
  onFocus,
  onMove,
}: WidgetTreePanelProps) {
  const { t } = useTranslation();
  return (
    <Card
      size="small"
      className="editor-panel widget-tree-panel"
      title={t('lowcode.widgetTree')}
      extra={
        <div className="widget-tree-actions">
          <TreeActionButton
            title={`${t('lowcode.undo')} (${modifier}+Z)`}
            icon={<UndoOutlined />}
            disabled={!canUndo}
            onClick={onUndo}
          />
          <TreeActionButton
            title={`${t('lowcode.redo')} (${modifier}+Shift+Z)`}
            icon={<RedoOutlined />}
            disabled={!canRedo}
            onClick={onRedo}
          />
          <TreeActionButton
            title={`${t('lowcode.copyWidget')} (${modifier}+C)`}
            icon={<CopyOutlined />}
            disabled={!canCopy}
            onClick={onCopy}
          />
          <TreeActionButton
            title={`${t('lowcode.pasteWidget')} (${modifier}+V)`}
            icon={<SnippetsOutlined />}
            disabled={!canPaste}
            onClick={onPaste}
          />
          <TreeActionButton
            title={`${t('lowcode.deleteWidget')} (Del)`}
            icon={<DeleteOutlined />}
            disabled={!canDelete}
            danger
            onClick={onDelete}
          />
          <Tooltip title={t('lowcode.addWidget')}>
            <Button size="small" icon={<PlusOutlined />} disabled={addDisabled} onClick={onAdd} />
          </Tooltip>
        </div>
      }
    >
      {widgets.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.emptyWidgets')} />
      ) : (
        <div ref={treeHostRef}>
          <Tree
            className="widget-tree"
            blockNode
            virtual={false}
            autoExpandParent={false}
            // 只读，或标题要拖进数据面板时，关掉树内排序。
            draggable={!readOnly && !canDragWidgetToData ? { icon: false } : false}
            allowDrop={({ dragNode, dropNode, dropPosition }) => {
              const placement: WidgetDropPlacement =
                dropPosition === 0 ? 'inside' : dropPosition < 0 ? 'before' : 'after';
              return canMoveWidget(widgets, String(dragNode.key), String(dropNode.key), placement);
            }}
            expandedKeys={expandedKeys}
            selectedKeys={selectedWidgetId ? [selectedWidgetId] : []}
            treeData={treeData}
            titleRender={(node) => {
              const widgetId = String(node.key);
              const widget = findWidget(widgets, widgetId);
              const looped = isLoopConfigured(widget?.loop);
              const hidden = Boolean(widget?.hidden);
              const alias = widget?.alias?.trim();
              const titleClasses = [
                'widget-tree-title',
                hidden ? 'is-hidden' : '',
                selectedWidgetId === widgetId ? 'is-row-selected' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <Dropdown
                  trigger={['contextMenu']}
                  menu={{
                    items: [
                      {
                        key: 'alias',
                        label: t('lowcode.setAlias'),
                        disabled: readOnly,
                      },
                    ],
                    onClick: ({ key }) => {
                      if (key === 'alias') {
                        onOpenAlias(widgetId);
                      }
                    },
                  }}
                >
                  <span className={titleClasses} onContextMenu={() => onSelect(widgetId)}>
                    <span
                      className={
                        canDragWidgetToData
                          ? 'widget-tree-drag-title'
                          : alias
                            ? 'widget-tree-title-label is-alias'
                            : 'widget-tree-title-label'
                      }
                      draggable={canDragWidgetToData}
                      onDragStart={(event) => {
                        // 阻止冒泡，否则会同时触发树节点的排序拖拽。
                        event.stopPropagation();
                        event.dataTransfer.effectAllowed = 'copy';
                        writeWidgetDrag(event.dataTransfer, widgetId);
                      }}
                    >
                      {alias ?? (typeof node.title === 'string' ? node.title : widgetId)}
                    </span>
                    {looped ? (
                      <button
                        type="button"
                        className="widget-tree-loop"
                        title={t('lowcode.styleLoop')}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenLoop(widgetId);
                        }}
                      >
                        <UnorderedListOutlined />
                      </button>
                    ) : null}
                    <span className="widget-tree-actions-inline">
                      <button
                        type="button"
                        className="widget-tree-visibility"
                        title={hidden ? t('lowcode.showWidget') : t('lowcode.hideWidget')}
                        disabled={readOnly}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleHidden(widgetId);
                        }}
                      >
                        {hidden ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      </button>
                    </span>
                  </span>
                </Dropdown>
              );
            }}
            onExpand={(keys) => onExpand(keys.map(String))}
            onSelect={(keys) => {
              if (keys[0]) {
                onSelect(String(keys[0]));
              }
            }}
            onDrop={(info) => {
              if (readOnly) {
                return;
              }
              const dragId = String(info.dragNode.key);
              const dropId = String(info.node.key);
              const placement = treeDropPlacement(info.dropToGap, info.node.pos, info.dropPosition);
              onMove(dragId, dropId, placement);
            }}
            onDoubleClick={(_event, node) => {
              const widgetId = String(node.key);
              if (widgetId) {
                onFocus(widgetId);
              }
            }}
          />
        </div>
      )}
    </Card>
  );
}

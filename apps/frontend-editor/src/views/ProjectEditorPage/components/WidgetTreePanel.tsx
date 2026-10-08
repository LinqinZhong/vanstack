import {
  CopyOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  PlusOutlined,
  RedoOutlined,
  SnippetsOutlined,
  ThunderboltOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Button, Card, Dropdown, Empty, Tooltip, Tree, type TreeDataNode } from 'antd';
import { memo, useLayoutEffect, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { hasWidgetEvents, isLoopConfigured, type PageWidget } from '@vanstack/xml';
import { writeWidgetDrag } from '../../../utils/pageData';
import { canMoveWidget, findWidget, type WidgetDropPlacement } from '../../../utils/widgetTree';
import { TreeActionButton } from './TreeActionButton';

/**
 * 组件树：展开、选中、拖拽换层级，以及撤销、重做、复制、粘贴、删除、添加。
 * 拖到某个位置是否合法由 canMoveWidget 决定；不合法的落点不会触发 onMove。
 * 数据面板打开、标题可以拖进变量（canDragWidgetToData）时关掉树内排序，避免两套拖拽抢同一个指针事件。
 * 右键打开别名菜单，循环图标打开循环配置，事件图标打开事件列表，眼睛切换 hidden。双击通知页面把画布对准该控件。
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
  onOpenEvents: (widgetId: string) => void;
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
/**
 * 眼睛挂到行节点末尾，才能贴住整行右缘。
 * 横向滚动时靠 sticky 留在面板右侧，标题从它左边滚过去。
 */
function TreeRowEye({ className, children }: { className: string; children: ReactNode }) {
  const [row, setRow] = useState<HTMLElement | null>(null);
  const eye = <span className={className}>{children}</span>;
  return (
    <>
      <span
        className="widget-tree-eye-anchor"
        ref={(node) => {
          const next = node?.closest<HTMLElement>('.ant-tree-treenode') ?? null;
          setRow((current) => (current === next ? current : next));
        }}
      />
      {row ? createPortal(eye, row) : eye}
    </>
  );
}

const TreeTitle = memo(function TreeTitle({
  widgetId,
  label,
  alias,
  hidden,
  looped,
  hasEvents,
  selected,
  readOnly,
  canDragWidgetToData,
  onSelect,
  onOpenAlias,
  onOpenLoop,
  onOpenEvents,
  onToggleHidden,
  loopTitle,
  eventsTitle,
  showTitle,
  hideTitle,
  aliasMenuLabel,
}: {
  widgetId: string;
  label: string;
  alias?: string;
  hidden: boolean;
  looped: boolean;
  hasEvents: boolean;
  selected: boolean;
  readOnly: boolean;
  canDragWidgetToData: boolean;
  onSelect: (widgetId: string) => void;
  onOpenAlias: (widgetId: string) => void;
  onOpenLoop: (widgetId: string) => void;
  onOpenEvents: (widgetId: string) => void;
  onToggleHidden: (widgetId: string) => void;
  loopTitle: string;
  eventsTitle: string;
  showTitle: string;
  hideTitle: string;
  aliasMenuLabel: string;
}) {
  const titleClasses = ['widget-tree-title', hidden ? 'is-hidden' : '', selected ? 'is-row-selected' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <Dropdown
      trigger={['contextMenu']}
      menu={{
        items: [
          {
            key: 'alias',
            label: aliasMenuLabel,
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
            event.stopPropagation();
            event.dataTransfer.effectAllowed = 'copy';
            writeWidgetDrag(event.dataTransfer, widgetId);
          }}
        >
          {alias ?? label}
        </span>
        {looped ? (
          <button
            type="button"
            className="widget-tree-loop"
            title={loopTitle}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onOpenLoop(widgetId);
            }}
          >
            <UnorderedListOutlined />
          </button>
        ) : null}
        {hasEvents ? (
          <button
            type="button"
            className="widget-tree-event"
            title={eventsTitle}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onOpenEvents(widgetId);
            }}
          >
            <ThunderboltOutlined />
          </button>
        ) : null}
        <TreeRowEye
          className={['widget-tree-actions-inline', hidden ? 'is-hidden' : '', selected ? 'is-row-selected' : '']
            .filter(Boolean)
            .join(' ')}
        >
          <button
            type="button"
            className="widget-tree-visibility"
            title={hidden ? showTitle : hideTitle}
            disabled={readOnly}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onToggleHidden(widgetId);
            }}
          >
            {hidden ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          </button>
        </TreeRowEye>
      </span>
    </Dropdown>
  );
}, (prev, next) =>
  prev.widgetId === next.widgetId &&
  prev.label === next.label &&
  prev.alias === next.alias &&
  prev.hidden === next.hidden &&
  prev.looped === next.looped &&
  prev.hasEvents === next.hasEvents &&
  prev.selected === next.selected &&
  prev.readOnly === next.readOnly &&
  prev.canDragWidgetToData === next.canDragWidgetToData &&
  prev.loopTitle === next.loopTitle &&
  prev.eventsTitle === next.eventsTitle &&
  prev.showTitle === next.showTitle &&
  prev.hideTitle === next.hideTitle &&
  prev.aliasMenuLabel === next.aliasMenuLabel,
);

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
  onOpenEvents,
  onToggleHidden,
  onExpand,
  onSelect,
  onFocus,
  onMove,
}: WidgetTreePanelProps) {
  const { t } = useTranslation();
  const [treeHeight, setTreeHeight] = useState(320);
  const treeRef = useRef<ComponentRef<typeof Tree>>(null);
  // 选中项变化时把它滚到可见位置。树是虚拟列表，视口外的节点尚未生成 DOM
  // （例如新增到树尾的控件），DOM scrollIntoView 找不到节点，必须走 Tree 的 scrollTo(key)。
  useLayoutEffect(() => {
    if (!selectedWidgetId) {
      return;
    }
    treeRef.current?.scrollTo({ key: selectedWidgetId, align: 'auto' });
  }, [selectedWidgetId, expandedKeys]);
  useLayoutEffect(() => {
    const node = treeHostRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }
    const measure = () => {
      const next = Math.floor(node.clientHeight);
      setTreeHeight((current) => (next > 0 && current !== next ? next : current));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [treeHostRef, widgets.length]);
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
        <div ref={treeHostRef} className="widget-tree-host">
          <Tree
            ref={treeRef}
            className="widget-tree"
            blockNode
            virtual
            height={treeHeight}
            itemHeight={24}
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
              const alias = widget?.alias?.trim();
              return (
                <TreeTitle
                  widgetId={widgetId}
                  label={typeof node.title === 'string' ? node.title : widgetId}
                  alias={alias || undefined}
                  hidden={Boolean(widget?.hidden)}
                  looped={isLoopConfigured(widget?.loop)}
                  hasEvents={hasWidgetEvents(widget?.events)}
                  selected={selectedWidgetId === widgetId}
                  readOnly={readOnly}
                  canDragWidgetToData={canDragWidgetToData}
                  onSelect={onSelect}
                  onOpenAlias={onOpenAlias}
                  onOpenLoop={onOpenLoop}
                  onOpenEvents={onOpenEvents}
                  onToggleHidden={onToggleHidden}
                  loopTitle={t('lowcode.styleLoop')}
                  eventsTitle={t('lowcode.styleEvents')}
                  showTitle={t('lowcode.showWidget')}
                  hideTitle={t('lowcode.hideWidget')}
                  aliasMenuLabel={t('lowcode.setAlias')}
                />
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

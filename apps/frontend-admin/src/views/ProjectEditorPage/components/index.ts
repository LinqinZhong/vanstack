/**
 * 编辑器拆出去的界面块。
 * 草稿、撤销、选中和保存仍在 ProjectEditorPage；这里的组件只画自己那一块，通过回调把操作交回页面。
 */
export { AddWidgetModal, type AddWidgetChoice } from './AddWidgetModal';
export { AliasModal } from './AliasModal';
export { CanvasWorkspace } from './CanvasWorkspace';
export { CreateVersionModal, type VersionFormValues } from './CreateVersionModal';
export { EditorHeader } from './EditorHeader';
export { EditorInspector } from './EditorInspector';
export { EditorLibraries } from './EditorLibraries';
export { EditorRail, type EditorNav } from './EditorRail';
export { PageFormModal, type PageFormValues } from './PageFormModal';
export { PageListPanel, type CatalogKind } from './PageListPanel';
export { ProjectMissing } from './ProjectMissing';
export { VersionListPanel } from './VersionListPanel';
export { WidgetTreePanel } from './WidgetTreePanel';

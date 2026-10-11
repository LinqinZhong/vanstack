import { useTranslation } from 'react-i18next';
import type { ComponentProp } from '@vanstack/xml';

export type ComponentSlotListItem = {
  /** 选择键：组件编辑态下的插槽虚拟 id。 */
  key: string;
  /** 插槽名称（含描述回退）。 */
  name: string;
  /** 插槽入参（定义插槽时的出参）。 */
  params: ComponentProp[];
};

type ComponentSlotListProps = {
  items: ComponentSlotListItem[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
};

/** 组件编辑态的画布浮动插槽列表：点击项选中对应插槽，项下展示插槽入参。 */
export function ComponentSlotList({ items, selectedKey, onSelect }: ComponentSlotListProps) {
  const { t } = useTranslation();
  return (
    <div
      className="canvas-slot-list"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="canvas-slot-list-title">{t('lowcode.slotsTitle')}</div>
      <ul className="canvas-slot-list-items">
        {items.map((item) => (
          <li
            key={item.key}
            className={item.key === selectedKey ? 'is-active' : undefined}
            onClick={() => onSelect(item.key)}
          >
            <div className="canvas-slot-list-name">{item.name}</div>
            {item.params.length > 0 ? (
              <div className="canvas-slot-list-params">
                {item.params.map((param, index) => (
                  <div key={`${param.name}:${index}`} className="canvas-slot-list-param">
                    <div className="canvas-slot-list-param-head">
                      {param.name}: {param.type}
                    </div>
                    {param.desc?.trim() ? (
                      <div className="canvas-slot-list-param-desc">{param.desc}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
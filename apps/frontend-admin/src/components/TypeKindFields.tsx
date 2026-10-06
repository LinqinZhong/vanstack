import { Cascader } from 'antd';
import type { DefaultOptionType } from 'antd/es/cascader';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ComponentPropType, PageDataType } from '@vanstack/xml';
import { api } from '../apis/api';

export const SCALAR_TYPES = ['num', 'str', 'bool'] as const;
export const PROP_TYPES = ['num', 'str', 'bool', 'arr', 'obj', 'icon', 'image'] as const;
export const DATA_TYPES = ['num', 'str', 'bool', 'arr', 'obj', 'icon', 'image', 'widget'] as const;

const ITEM_TYPES = ['num', 'str', 'bool', 'obj', 'icon', 'image', 'widget'] as const;
const NS = 'ns:';
const DIVIDER = '\0';

export type TypeKind = PageDataType | ComponentPropType;

export type NamespaceCatalogEntry = {
  name: string;
  types: string[];
};

type TypeKindFieldsProps = {
  type: string;
  of?: string;
  allow: readonly TypeKind[];
  namespaces?: NamespaceCatalogEntry[];
  disabled?: boolean;
  onChange: (next: { type: TypeKind; of?: string; reset: boolean }) => void;
};

type TypeChoice = {
  value: string;
  label: string;
};

export function useNamespaceCatalog(projectId: string): NamespaceCatalogEntry[] {
  const [catalog, setCatalog] = useState<NamespaceCatalogEntry[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await api.listNamespaces(projectId);
        const docs = await Promise.all(rows.map((row) => api.getNamespace(projectId, row.name)));
        const next = docs
          .map((doc) => ({
            name: doc.name,
            types: [...new Set(doc.types.map((item) => item.name).filter(Boolean))],
          }))
          .filter((item) => item.name && item.types.length > 0);
        if (!cancelled) {
          setCatalog(next);
        }
      } catch {
        if (!cancelled) {
          setCatalog([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);
  return catalog;
}

export function formatTypeLabel(
  type: string,
  of: string | undefined,
  label: (key: string) => string,
): string {
  if (type === 'obj' && of) {
    return of;
  }
  if (type === 'arr') {
    const item = of ? (isItemBuiltin(of) ? label(of) : of) : '';
    return item ? `${label('arr')}<${item}>` : label('arr');
  }
  return label(type);
}

export function TypeCascader({
  value,
  choices,
  namespaces = [],
  disabled,
  onChange,
}: {
  value: string;
  choices: TypeChoice[];
  namespaces?: NamespaceCatalogEntry[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const options = typeOptions(choices, namespaces, value);
  return (
    <Cascader
      className="type-kind-cascader"
      size="small"
      disabled={disabled}
      allowClear={false}
      expandTrigger="hover"
      options={options}
      value={choicePath(value, choices, namespaces)}
      displayRender={(labels) => String(labels[labels.length - 1] ?? '')}
      popupClassName="type-kind-popup"
      onChange={(path) => {
        const leaf = String(path[path.length - 1] ?? '');
        if (!leaf || leaf === DIVIDER || leaf.startsWith(NS)) {
          return;
        }
        onChange(leaf);
      }}
    />
  );
}

export function TypeKindFields({ type, of, allow, namespaces = [], disabled, onChange }: TypeKindFieldsProps) {
  const { t } = useTranslation();
  const label = (key: string) => t(`lowcode.propType.${key}`, { defaultValue: key });
  const choices = allow.map((item) => ({ value: item, label: label(item) }));
  const itemChoices = ITEM_TYPES.filter((item) => (item === 'widget' || item === 'icon' || item === 'image' ? allow.includes(item) : true)).map(
    (item) => ({ value: item, label: label(item) }),
  );
  const primary = type === 'obj' && of ? of : type;
  const known = new Set<string>(choices.map((item) => item.value));

  return (
    <div className="page-type-fields">
      <TypeCascader
        value={primary}
        choices={choices}
        namespaces={namespaces}
        disabled={disabled}
        onChange={(value) => {
          if (!known.has(value)) {
            onChange({ type: 'obj', of: value, reset: type !== 'obj' });
            return;
          }
          if (value === 'arr') {
            onChange({ type: 'arr', of: type === 'arr' ? of : undefined, reset: type !== 'arr' });
            return;
          }
          onChange({ type: value as TypeKind, of: undefined, reset: true });
        }}
      />
      {type === 'arr' && allow.includes('arr') ? (
        <TypeCascader
          value={of ?? ''}
          choices={itemChoices}
          namespaces={namespaces}
          disabled={disabled}
          onChange={(value) => onChange({ type: 'arr', of: value, reset: false })}
        />
      ) : null}
    </div>
  );
}

function typeOptions(choices: TypeChoice[], namespaces: NamespaceCatalogEntry[], current: string): DefaultOptionType[] {
  const builtin = new Set(choices.map((item) => item.value));
  const groups = namespaces
    .map((entry) => ({
      name: entry.name,
      types: entry.types.filter((name) => name && !builtin.has(name)),
    }))
    .filter((entry) => entry.name && entry.types.length > 0);
  const listed = new Set(groups.flatMap((entry) => entry.types));
  const options: DefaultOptionType[] = choices.map((item) => ({ value: item.value, label: item.label }));
  const extra: DefaultOptionType[] = [];
  if (current && !builtin.has(current) && !listed.has(current)) {
    extra.push({ value: current, label: current });
  }
  if (groups.length === 0 && extra.length === 0) {
    return options;
  }
  return [
    ...options,
    { value: DIVIDER, disabled: true, label: <span className="type-kind-divider" /> },
    ...groups.map((entry) => ({
      value: `${NS}${entry.name}`,
      label: entry.name,
      children: entry.types.map((name) => ({ value: name, label: name })),
    })),
    ...extra,
  ];
}

function choicePath(value: string, choices: TypeChoice[], namespaces: NamespaceCatalogEntry[]): string[] {
  if (!value) {
    return [];
  }
  if (choices.some((item) => item.value === value)) {
    return [value];
  }
  const owner = namespaces.find((entry) => entry.types.includes(value));
  return owner ? [`${NS}${owner.name}`, value] : [value];
}

function isItemBuiltin(value: string): boolean {
  return (ITEM_TYPES as readonly string[]).includes(value);
}

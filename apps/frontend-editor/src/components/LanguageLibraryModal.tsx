import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Popconfirm, Segmented, Table, Tabs, message } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  compactPageI18n,
  isI18nKey,
  PAGE_I18N_DIRS,
  type PageI18n,
  type PageI18nDir,
  type PageI18nEntry,
  type PageI18nGroup,
  type PageI18nLang,
} from '@vanstack/xml';

const EMPTY_I18N: PageI18n = { langs: [], groups: [] };

function nextI18nKey(prefix: string, used: string[]) {
  const taken = new Set(used);
  let n = 1;
  while (taken.has(`${prefix}${n}`)) {
    n += 1;
  }
  return `${prefix}${n}`;
}

function renameLangKey(catalog: PageI18n, from: string, to: string): PageI18n {
  return {
    langs: catalog.langs.map((lang) => (lang.key === from ? { ...lang, key: to } : lang)),
    groups: catalog.groups.map((group) => ({
      ...group,
      entries: group.entries.map((entry) => {
        if (!(from in entry.values)) {
          return entry;
        }
        const values = { ...entry.values };
        values[to] = values[from] ?? '';
        delete values[from];
        return { ...entry, values };
      }),
    })),
  };
}

function dropLang(catalog: PageI18n, key: string): PageI18n {
  return {
    langs: catalog.langs.filter((lang) => lang.key !== key),
    groups: catalog.groups.map((group) => ({
      ...group,
      entries: group.entries.map((entry) => {
        if (!(key in entry.values)) {
          return entry;
        }
        const values = { ...entry.values };
        delete values[key];
        return { ...entry, values };
      }),
    })),
  };
}

export function LanguageLibraryPanel({
  catalog,
  disabled,
  onChange,
}: {
  catalog?: PageI18n;
  disabled?: boolean;
  onChange: (next: PageI18n | undefined, coalesceKey?: string) => void;
}) {
  const { t } = useTranslation();
  const current = catalog ?? EMPTY_I18N;
  const [groupKey, setGroupKey] = useState(current.groups[0]?.key);

  useEffect(() => {
    setGroupKey((prev) => current.groups.find((group) => group.key === prev)?.key ?? current.groups[0]?.key);
  }, [current.groups]);

  function commit(next: PageI18n, coalesceKey?: string) {
    onChange(compactPageI18n(next), coalesceKey);
  }

  function rejectKey(raw: string, used: string[]) {
    const key = raw.trim();
    if (!isI18nKey(key)) {
      return t('lowcode.i18nInvalidKey');
    }
    if (used.includes(key)) {
      return t('lowcode.i18nDuplicateKey');
    }
    return null;
  }

  function patchLang(index: number, patch: Partial<PageI18nLang>, coalesceKey?: string) {
    const lang = current.langs[index];
    if (!lang) {
      return false;
    }
    if (patch.key != null && patch.key !== lang.key) {
      const error = rejectKey(
        patch.key,
        current.langs.filter((_, i) => i !== index).map((item) => item.key),
      );
      if (error) {
        return error;
      }
      commit(renameLangKey(current, lang.key, patch.key.trim()));
      return null;
    }
    commit(
      {
        ...current,
        langs: current.langs.map((item, i) => (i === index ? { ...item, ...patch } : item)),
      },
      coalesceKey,
    );
    return null;
  }

  function addLang() {
    const key = nextI18nKey('lang', current.langs.map((lang) => lang.key));
    commit({
      ...current,
      langs: [...current.langs, { key, name: key, dir: 'ltr' }],
    });
  }

  function addGroup() {
    const key = nextI18nKey('group', current.groups.map((group) => group.key));
    commit({
      ...current,
      groups: [...current.groups, { key, entries: [{ key: nextI18nKey('key', []), values: {} }] }],
    });
    setGroupKey(key);
  }

  function patchGroup(index: number, patch: Partial<PageI18nGroup>) {
    const group = current.groups[index];
    if (!group) {
      return false;
    }
    if (patch.key != null && patch.key !== group.key) {
      const error = rejectKey(
        patch.key,
        current.groups.filter((_, i) => i !== index).map((item) => item.key),
      );
      if (error) {
        return error;
      }
      const nextKey = patch.key.trim();
      commit({
        ...current,
        groups: current.groups.map((item, i) => (i === index ? { ...item, key: nextKey } : item)),
      });
      setGroupKey(nextKey);
      return null;
    }
    commit({
      ...current,
      groups: current.groups.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    });
    return null;
  }

  function addEntry(groupIndex: number) {
    const group = current.groups[groupIndex];
    if (!group) {
      return;
    }
    const key = nextI18nKey('key', group.entries.map((entry) => entry.key));
    patchGroup(groupIndex, { entries: [...group.entries, { key, values: {} }] });
  }

  function patchEntry(groupIndex: number, entryIndex: number, patch: Partial<PageI18nEntry>, coalesceKey?: string) {
    const group = current.groups[groupIndex];
    const entry = group?.entries[entryIndex];
    if (!group || !entry) {
      return false;
    }
    if (patch.key != null && patch.key !== entry.key) {
      const error = rejectKey(
        patch.key,
        group.entries.filter((_, i) => i !== entryIndex).map((item) => item.key),
      );
      if (error) {
        return error;
      }
    }
    const nextEntry = { ...entry, ...patch, key: patch.key?.trim() ?? entry.key };
    commit(
      {
        ...current,
        groups: current.groups.map((item, i) =>
          i === groupIndex
            ? { ...item, entries: item.entries.map((row, j) => (j === entryIndex ? nextEntry : row)) }
            : item,
        ),
      },
      coalesceKey,
    );
    return null;
  }

  const activeGroupIndex = current.groups.findIndex((group) => group.key === groupKey);
  const activeGroup = activeGroupIndex >= 0 ? current.groups[activeGroupIndex] : undefined;

  const entryColumns = [
    {
      title: t('lowcode.i18nEntryKey'),
      dataIndex: 'key',
      width: 168,
      render: (_: string, entry: PageI18nEntry, index: number) => (
        <Input
          size="small"
          variant="filled"
          disabled={disabled}
          defaultValue={entry.key}
          key={entry.key}
          onBlur={(event) => {
            const error = patchEntry(activeGroupIndex, index, { key: event.target.value });
            if (error) {
              message.error(error);
              event.target.value = entry.key;
            }
          }}
          onPressEnter={(event) => event.currentTarget.blur()}
        />
      ),
    },
    ...current.langs.map((lang) => ({
      title: lang.name || lang.key,
      dataIndex: lang.key,
      render: (_: string, entry: PageI18nEntry, index: number) => (
        <Input
          size="small"
          variant="filled"
          disabled={disabled}
          value={entry.values[lang.key] ?? ''}
          onChange={(event) =>
            patchEntry(
              activeGroupIndex,
              index,
              { values: { ...entry.values, [lang.key]: event.target.value } },
              `i18n:${activeGroup?.key}:${entry.key}:${lang.key}`,
            )
          }
        />
      ),
    })),
    {
      title: '',
      key: 'actions',
      width: 44,
      render: (_: unknown, _entry: PageI18nEntry, index: number) =>
        disabled ? null : (
          <Popconfirm
            title={t('lowcode.confirmDelete')}
            onConfirm={() => {
              if (!activeGroup) {
                return;
              }
              patchGroup(activeGroupIndex, { entries: activeGroup.entries.filter((_, i) => i !== index) });
            }}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ),
    },
  ];

  return (
    <div className="language-library-panel">
      <aside className="language-library-langs">
        <div className="language-library-section-head">
          <span>{t('lowcode.i18nLanguages')}</span>
          <Button size="small" type="primary" icon={<PlusOutlined />} disabled={disabled} onClick={addLang}>
            {t('lowcode.i18nAddLanguage')}
          </Button>
        </div>
        <div className="language-library-lang-list">
          {current.langs.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.i18nEmptyLanguages')} />
          ) : (
            current.langs.map((lang, index) => (
              <div className="language-library-lang" key={lang.key}>
                <div className="language-library-lang-top">
                  <Input
                    size="small"
                    variant="filled"
                    disabled={disabled}
                    value={lang.name}
                    placeholder={t('lowcode.i18nLangName')}
                    onChange={(event) => patchLang(index, { name: event.target.value }, `i18n:lang:${lang.key}:name`)}
                  />
                  {disabled ? null : (
                    <Popconfirm title={t('lowcode.confirmDelete')} onConfirm={() => commit(dropLang(current, lang.key))}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                </div>
                <div className="language-library-lang-meta">
                  <Input
                    size="small"
                    variant="filled"
                    disabled={disabled}
                    defaultValue={lang.key}
                    key={lang.key}
                    placeholder={t('lowcode.i18nLangKey')}
                    onBlur={(event) => {
                      const error = patchLang(index, { key: event.target.value });
                      if (error) {
                        message.error(error);
                        event.target.value = lang.key;
                      }
                    }}
                    onPressEnter={(event) => event.currentTarget.blur()}
                  />
                  <Segmented
                    size="small"
                    disabled={disabled}
                    value={lang.dir}
                    options={PAGE_I18N_DIRS.map((dir) => ({
                      value: dir,
                      label: dir === 'ltr' ? t('lowcode.i18nDirLtr') : t('lowcode.i18nDirRtl'),
                    }))}
                    onChange={(dir) => patchLang(index, { dir: dir as PageI18nDir })}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
      <section className="language-library-groups">
        {current.groups.length === 0 ? (
          <div className="language-library-empty">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('lowcode.i18nEmptyGroups')}>
              <Button size="small" type="primary" icon={<PlusOutlined />} disabled={disabled} onClick={addGroup}>
                {t('lowcode.i18nAddGroup')}
              </Button>
            </Empty>
          </div>
        ) : (
          <Tabs
            className="language-library-tabs"
            size="small"
            activeKey={groupKey}
            onChange={setGroupKey}
            tabBarExtraContent={
              <Button size="small" icon={<PlusOutlined />} disabled={disabled} onClick={addGroup}>
                {t('lowcode.i18nAddGroup')}
              </Button>
            }
            items={current.groups.map((group) => ({
              key: group.key,
              label: group.key,
            }))}
          />
        )}
        {activeGroup ? (
          <div className="language-library-group-pane">
            <div className="language-library-toolbar">
              <Input
                size="small"
                variant="filled"
                className="language-library-group-key"
                disabled={disabled}
                defaultValue={activeGroup.key}
                key={activeGroup.key}
                placeholder={t('lowcode.i18nLangKey')}
                onBlur={(event) => {
                  const error = patchGroup(activeGroupIndex, { key: event.target.value });
                  if (error) {
                    message.error(error);
                    event.target.value = activeGroup.key;
                  }
                }}
                onPressEnter={(event) => event.currentTarget.blur()}
              />
              <div className="language-library-toolbar-actions">
                <Button
                  size="small"
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={disabled}
                  onClick={() => addEntry(activeGroupIndex)}
                >
                  {t('lowcode.i18nAddEntry')}
                </Button>
                {disabled ? null : (
                  <Popconfirm
                    title={t('lowcode.confirmDelete')}
                    onConfirm={() => {
                      commit({ ...current, groups: current.groups.filter((_, i) => i !== activeGroupIndex) });
                    }}
                  >
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                )}
              </div>
            </div>
            <div className="language-library-table-wrap">
              <Table
                size="small"
                pagination={false}
                rowKey="key"
                tableLayout="fixed"
                dataSource={activeGroup.entries}
                columns={entryColumns}
                locale={{ emptyText: t('lowcode.i18nEmptyEntries') }}
              />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

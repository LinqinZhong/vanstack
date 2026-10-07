import { EditorState, Transaction, type Extension } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { useEffect, useMemo, useRef } from 'react';
import { refreshIconMarks, iconScriptExtensions } from '../utils/iconScript';
import { subscribeIconCatalog } from '../utils/iconCatalog';

const shellExtensions: Extension[] = [protectShell(), clampShellSelection(), shellLineStyle()];

type ScriptEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  extensions?: Extension[];
  editable?: boolean;
  height?: string;
  /** 系统提供的首行，例如 `function name(){`，不可修改。 */
  prefix?: string;
  /** 系统提供的末行，例如 `}`，不可修改。 */
  suffix?: string;
};

export function ScriptEditor({
  value,
  onChange,
  extensions,
  editable = true,
  height = '240px',
  prefix,
  suffix,
}: ScriptEditorProps) {
  const viewRef = useRef<EditorView | null>(null);
  const shelled = Boolean(prefix && suffix);
  const prefixText = shelled ? `${prefix}\n` : '';
  const suffixText = shelled ? `\n${suffix}` : '';
  const doc = `${prefixText}${value}${suffixText}`;
  const editorExtensions = useMemo(
    () => [...iconScriptExtensions, ...(extensions ?? []), ...(shelled ? shellExtensions : [])],
    [extensions, shelled],
  );
  useEffect(() => subscribeIconCatalog(() => {
    const view = viewRef.current;
    if (view) {
      refreshIconMarks(view);
    }
  }), []);

  return (
    <div className="page-data-code">
      <CodeMirror
        value={doc}
        height={height}
        theme="light"
        extensions={editorExtensions}
        editable={editable}
        basicSetup={{ foldGutter: false }}
        onCreateEditor={(view) => {
          viewRef.current = view;
        }}
        onChange={(next) => {
          if (!onChange) {
            return;
          }
          if (prefixText && !next.startsWith(prefixText)) {
            return;
          }
          if (suffixText && !next.endsWith(suffixText)) {
            return;
          }
          onChange(next.slice(prefixText.length, next.length - suffixText.length));
        }}
      />
    </div>
  );
}

function protectShell() {
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged || !tr.annotation(Transaction.userEvent)) {
      return tr;
    }
    const range = editableRange(tr.startState.doc);
    if (!range) {
      return tr;
    }
    let blocked = false;
    tr.changes.iterChangedRanges((from, to) => {
      if (from < range.from || to > range.to) {
        blocked = true;
      }
    });
    return blocked ? [] : tr;
  });
}

function editableRange(doc: { lines: number; line: (n: number) => { from: number; to: number } }) {
  if (doc.lines < 3) {
    return null;
  }
  const from = doc.line(1).to + 1;
  const to = doc.line(doc.lines).from - 1;
  return { from, to: Math.max(from, to) };
}

function clampShellSelection() {
  return EditorView.updateListener.of((update) => {
    if (!update.selectionSet && !update.docChanged) {
      return;
    }
    const range = editableRange(update.state.doc);
    if (!range) {
      return;
    }
    const selection = update.state.selection.main;
    if (selection.from >= range.from && selection.to <= range.to) {
      return;
    }
    const anchor = Math.min(Math.max(selection.anchor, range.from), range.to);
    const head = Math.min(Math.max(selection.head, range.from), range.to);
    update.view.dispatch({ selection: { anchor, head } });
  });
}

function shellLineStyle() {
  return EditorView.decorations.of((view) => {
    if (view.state.doc.lines < 3) {
      return Decoration.none;
    }
    const first = view.state.doc.line(1);
    const last = view.state.doc.line(view.state.doc.lines);
    return Decoration.set([
      Decoration.line({ class: 'cm-script-shell' }).range(first.from),
      Decoration.line({ class: 'cm-script-shell' }).range(last.from),
    ]);
  });
}

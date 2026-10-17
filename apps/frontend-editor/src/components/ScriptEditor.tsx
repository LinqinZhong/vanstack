import { EditorState, Prec, Transaction, type Extension } from '@codemirror/state';
import { Decoration, EditorView, keymap } from '@codemirror/view';
import { insertNewline, insertNewlineAndIndent } from '@codemirror/commands';
import { ensureSyntaxTree, getIndentation } from '@codemirror/language';
import { linter, type Diagnostic } from '@codemirror/lint';
import { javascript } from '@codemirror/lang-javascript';
import { FormatPainterOutlined } from '@ant-design/icons';
import CodeMirror from '@uiw/react-codemirror';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { refreshScriptMarks, iconScriptExtensions } from '../utils/iconScript';
import { subscribeIconCatalog } from '../utils/iconCatalog';
import { subscribeAssetCatalog } from '../utils/assetCatalog';
import { subscribeEditorI18n } from '../utils/i18nRuntime';

/** 一级缩进使用的空格数，与 @codemirror/language 默认 indentUnit 保持一致。 */
const INDENT_STR = '  ';

const shellExtensions: Extension[] = [protectShell(), clampShellSelection(), shellLineStyle()];

/** 编辑器统一使用 TypeScript 语法（JS 超集，也能解析 JSON 草稿）。 */
const tsLanguage = javascript({ typescript: true });

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
  /** 语法校验结果变化时回调；false 表示当前存在语法错误。 */
  onValidateChange?: (valid: boolean) => void;
};

export function ScriptEditor({
  value,
  onChange,
  extensions,
  editable = true,
  height = '240px',
  prefix,
  suffix,
  onValidateChange,
}: ScriptEditorProps) {
  const viewRef = useRef<EditorView | null>(null);
  const shelled = Boolean(prefix && suffix);
  const prefixText = shelled ? `${prefix}\n` : '';
  const suffixText = shelled ? `\n${suffix}` : '';
  // 函数体内容强制缩进一级，视觉上体现「在函数内部」。
  const bodyForDisplay = shelled ? indentBody(value, INDENT_STR) : value;
  const doc = `${prefixText}${bodyForDisplay}${suffixText}`;
  const [errorCount, setErrorCount] = useState(0);
  const validRef = useRef<boolean | null>(null);
  const onValidateRef = useRef(onValidateChange);
  onValidateRef.current = onValidateChange;

  const reportValidity = useCallback((text: string) => {
    const diagnostics = syntaxDiagnostics(text);
    setErrorCount(diagnostics.length);
    const valid = diagnostics.length === 0;
    if (validRef.current !== valid) {
      validRef.current = valid;
      onValidateRef.current?.(valid);
    }
  }, []);

  const formatEditor = useCallback(() => {
    const view = viewRef.current;
    if (view) {
      formatDocument(view);
    }
  }, []);

  const editorExtensions = useMemo(
    () => [
      tsLanguage,
      ...iconScriptExtensions,
      ...(extensions ?? []),
      ...(shelled ? shellExtensions : []),
      syntaxLint,
      validityListener(reportValidity),
      Prec.high(
        keymap.of([
          { key: 'Enter', run: insertNewlineAndIndent, shift: insertNewline },
          {
            key: 'Mod-Shift-f',
            run: (view) => {
              formatDocument(view);
              return true;
            },
          },
        ]),
      ),
      pasteAutoIndent(),
    ],
    [extensions, shelled],
  );

  useEffect(
    () =>
      subscribeIconCatalog(() => {
        const view = viewRef.current;
        if (view) {
          refreshScriptMarks(view);
        }
      }),
    [],
  );

  useEffect(
    () =>
      subscribeAssetCatalog(() => {
        const view = viewRef.current;
        if (view) {
          refreshScriptMarks(view);
        }
      }),
    [],
  );

  useEffect(
    () =>
      subscribeEditorI18n(() => {
        const view = viewRef.current;
        if (view) {
          refreshScriptMarks(view);
        }
      }),
    [],
  );

  return (
    <div className="page-data-code">
      <div className="script-editor-toolbar">
        {errorCount > 0 ? (
          <span className="script-editor-error">{errorCount} 处语法错误</span>
        ) : null}
        <button
          type="button"
          className="script-editor-format-btn"
          onClick={formatEditor}
          title="格式化代码 (Ctrl+Shift+F)"
        >
          <FormatPainterOutlined />
          <span>格式化</span>
          <kbd>Ctrl+Shift+F</kbd>
        </button>
      </div>
      <CodeMirror
        value={doc}
        height={height}
        theme="light"
        extensions={editorExtensions}
        editable={editable}
        basicSetup={{ foldGutter: false }}
        onCreateEditor={(view) => {
          viewRef.current = view;
          reportValidity(view.state.doc.toString());
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
          const body = next.slice(prefixText.length, next.length - suffixText.length);
          // 保存时剥离开强制的一级缩进，保持存储值干净。
          onChange(shelled ? deindentBody(body, INDENT_STR) : body);
        }}
      />
    </div>
  );
}

/** 给函数体每一行前加一级缩进，用于展示。 */
function indentBody(body: string, indent: string): string {
  return body
    .split('\n')
    .map((line) => indent + line)
    .join('\n');
}

/** 大括号开头的草稿包一层括号按表达式探测，避免语句位置的 JSON 对象/数组被误报。 */
function probeDoc(text: string): { text: string; toOriginal: (pos: number) => number } {
  const start = text.search(/\S/u);
  if (start < 0) {
    return { text: '', toOriginal: (pos) => pos };
  }
  const contentEnd = text.replace(/\s+$/u, '').length;
  const inner = text.slice(start, contentEnd);
  if (!/^[[{]/u.test(inner)) {
    return { text, toOriginal: (pos) => pos };
  }
  return {
    text: `${text.slice(0, start)}(${inner})`,
    toOriginal: (pos) => (pos <= start ? pos : pos <= start + inner.length ? pos - 1 : contentEnd),
  };
}

/** 用 TypeScript 语法解析草稿，返回错误诊断（探测文档的偏移会映射回原文）。 */
function syntaxDiagnostics(text: string): Diagnostic[] {
  if (!text.trim()) {
    return [];
  }
  const probe = probeDoc(text);
  const state = EditorState.create({ doc: probe.text, extensions: [tsLanguage] });
  const tree = ensureSyntaxTree(state, probe.text.length);
  if (!tree) {
    return [];
  }
  const ranges: Array<{ from: number; to: number }> = [];
  tree.iterate({
    enter: (node) => {
      if (node.type.isError) {
        ranges.push({ from: node.from, to: node.to });
        return false;
      }
      return undefined;
    },
  });
  return ranges.map((range) => {
    const from = Math.min(probe.toOriginal(range.from), Math.max(text.length - 1, 0));
    const to = Math.min(Math.max(probe.toOriginal(Math.max(range.to, range.from + 1)), from + 1), text.length);
    return { from, to, severity: 'error' as const, message: '语法错误' };
  });
}

const syntaxLint = linter((view) => syntaxDiagnostics(view.state.doc.toString()), { delay: 300 });

/** 文档变化时把语法校验结果上报给父组件（驱动「确定」按钮禁用）。 */
function validityListener(report: (text: string) => void): Extension {
  return EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      report(update.state.doc.toString());
    }
  });
}

/** 剥离开函数体每一行前的一级缩进，用于保存。 */
function deindentBody(body: string, indent: string): string {
  return body
    .split('\n')
    .map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line))
    .join('\n');
}

/** 基于语法树重新缩进整个文档。 */
function formatDocument(view: EditorView) {
  const state = view.state;
  const changes: { from: number; to: number; insert: string }[] = [];
  for (let lineNo = 1; lineNo <= state.doc.lines; lineNo++) {
    const line = state.doc.line(lineNo);
    const indent = getIndentation(state, line.from);
    if (indent == null) {
      continue;
    }
    const current = line.text.match(/^[\t ]*/)?.[0] ?? '';
    const target = ' '.repeat(indent);
    if (current !== target) {
      changes.push({ from: line.from, to: line.from + current.length, insert: target });
    }
  }
  if (changes.length) {
    view.dispatch({ changes });
  }
}

/** 粘贴时自动缩进：去除公共前导空白，再按当前行缩进对齐。 */
function pasteAutoIndent(): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      try {
        const text = event.clipboardData?.getData('text/plain');
        if (text == null || !text.includes('\n')) {
          return;
        }
        const state = view.state;
        const sel = state.selection.main;
        const line = state.doc.lineAt(sel.from);
        const lineIndent = getIndentation(state, line.from);
        const baseIndent = lineIndent ?? leadingSpaces(line.text);
        const lines = text.split('\n');
        const nonEmpty = lines.filter((l) => l.trim().length > 0);
        let common = Infinity;
        for (const l of nonEmpty) {
          common = Math.min(common, leadingSpaces(l));
        }
        if (!Number.isFinite(common)) {
          common = 0;
        }
        const reindented = lines
          .map((l, i) => {
            const stripped = l.slice(common);
            return i === 0 ? stripped : ' '.repeat(baseIndent) + stripped;
          })
          .join('\n');
        event.preventDefault();
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert: reindented },
          selection: { anchor: sel.from + reindented.length },
        });
        return true;
      } catch {
        // 缩进计算异常时回退到默认粘贴行为
      }
    },
  });
}

function leadingSpaces(text: string): number {
  const match = text.match(/^[\t ]*/);
  if (!match) {
    return 0;
  }
  return match[0].replace(/\t/g, '  ').length;
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

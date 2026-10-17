import { startCompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { javascriptLanguage, typescriptLanguage } from '@codemirror/lang-javascript';
import { linter, type Diagnostic } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { findDataRefRanges } from './pageData';

/**
 * 语言本身由 ScriptEditor 统一提供（TypeScript），
 * 这里只补充 $data/$props/$query/$slot/$local/$this 的补全与未知引用检查。
 */
export function createPageDataEditorExtensions(
  names: string[],
  unknownMessage: string,
  propNames: string[] = [],
  queryNames: string[] = [],
  slotNames: string[] = [],
  localNames: string[] = [],
  thisNames: string[] = [],
) {
  const known = new Set(names);
  const completions = {
    autocomplete: (context: CompletionContext) =>
      completeDataRef(context, names) ??
      completeScopeRef(context, '$props', propNames) ??
      completeScopeRef(context, '$query', queryNames) ??
      completeScopeRef(context, '$slot', slotNames) ??
      completeScopeRef(context, '$local', localNames) ??
      completeScopeRef(context, '$this', thisNames),
  };
  return [
    javascriptLanguage.data.of(completions),
    typescriptLanguage.data.of(completions),
    triggerDataRefCompletion(),
    linter(createDataRefLinter(known, unknownMessage), { delay: 150 }),
  ];
}

function triggerDataRefCompletion() {
  return EditorView.updateListener.of((update) => {
    if (!update.docChanged) {
      return;
    }
    const pos = update.state.selection.main.head;
    const recent = update.state.sliceDoc(Math.max(0, pos - 8), pos);
    if (
      recent.endsWith('$data.') ||
      recent.endsWith('$props.') ||
      recent.endsWith('$query.') ||
      recent.endsWith('$slot.') ||
      recent.endsWith('$local.') ||
      recent.endsWith('$this.')
    ) {
      startCompletion(update.view);
    }
  });
}

function completeDataRef(context: CompletionContext, names: string[]): CompletionResult | null {
  const match = context.matchBefore(/\$data\.[^\s,;:?)}\]]*/u);
  if (!match) {
    return null;
  }
  const prefix = '$data.';
  if (match.text.length < prefix.length) {
    return null;
  }
  return {
    from: match.from + prefix.length,
    options: names.map((name) => ({
      label: name,
      type: 'variable',
      detail: '$data',
    })),
    validFor: /^[\p{ID_Continue}$]*$/u,
  };
}

const SCOPE_REF: Record<'$props' | '$query' | '$slot' | '$local' | '$this', RegExp> = {
  $props: /\$props\.[^\s,;:?)}\]]*/u,
  $query: /\$query\.[^\s,;:?)}\]]*/u,
  $slot: /\$slot\.[^\s,;:?)}\]]*/u,
  $local: /\$local\.[^\s,;:?)}\]]*/u,
  $this: /\$this\.[^\s,;:?)}\]]*/u,
};

function completeScopeRef(
  context: CompletionContext,
  scope: '$props' | '$query' | '$slot' | '$local' | '$this',
  names: string[],
): CompletionResult | null {
  const prefix = `${scope}.`;
  const match = context.matchBefore(SCOPE_REF[scope]);
  if (!match || match.text.length < prefix.length) {
    return null;
  }
  return {
    from: match.from + prefix.length,
    options: names.map((name) => ({
      label: name,
      type: 'variable',
      detail: scope,
    })),
    validFor: /^[\p{ID_Continue}$]*$/u,
  };
}

function createDataRefLinter(names: Set<string>, message: string) {
  return (view: EditorView): Diagnostic[] => {
    const text = view.state.doc.toString();
    return findDataRefRanges(text)
      .filter((ref) => !names.has(ref.name))
      .map((ref) => ({
        from: ref.from,
        to: ref.to,
        severity: 'error' as const,
        message,
      }));
  };
}

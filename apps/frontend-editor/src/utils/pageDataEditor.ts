import { startCompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { javascript } from '@codemirror/lang-javascript';
import { linter, type Diagnostic } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { findDataRefRanges } from './pageData';

export function createPageDataEditorExtensions(
  names: string[],
  unknownMessage: string,
  propNames: string[] = [],
  queryNames: string[] = [],
) {
  const known = new Set(names);
  const language = javascript();
  return [
    language,
    language.language.data.of({
      autocomplete: (context: CompletionContext) =>
        completeDataRef(context, names) ??
        completeScopeRef(context, '$props', propNames) ??
        completeScopeRef(context, '$query', queryNames),
    }),
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
    const recent = update.state.sliceDoc(Math.max(0, pos - 7), pos);
    if (recent === '$data.' || recent.endsWith('$props.') || recent.endsWith('$query.')) {
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

function completeScopeRef(
  context: CompletionContext,
  scope: '$props' | '$query',
  names: string[],
): CompletionResult | null {
  const prefix = `${scope}.`;
  const match = context.matchBefore(scope === '$props' ? /\$props\.[^\s,;:?)}\]]*/u : /\$query\.[^\s,;:?)}\]]*/u);
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

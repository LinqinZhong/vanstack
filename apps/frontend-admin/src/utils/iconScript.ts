import { startCompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { EditorState, StateEffect, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { getIconCatalog, iconCatalogGeneration } from './iconCatalog';
import { getI18nEntries } from './i18nRuntime';

const iconCatalogChanged = StateEffect.define<number>();

const ICON_CALL = /\$icon\(\s*(['"])([^'"]+)\1\s*\)/g;
const ICON_ARG = /\$icon\(\s*(['"])[^'"]*$/;
const T_ARG = /\$t\(\s*"([^"]*)$/;

class IconMark extends WidgetType {
  constructor(private readonly url: string) {
    super();
  }

  eq(other: IconMark) {
    return other.url === this.url;
  }

  ignoreEvent() {
    return true;
  }

  toDOM() {
    const image = document.createElement('img');
    image.className = 'cm-icon-call';
    image.alt = '';
    image.src = this.url;
    return image;
  }
}

function iconCallDecorations(view: EditorView): DecorationSet {
  const catalog = getIconCatalog();
  const marks = [];
  for (const match of view.state.doc.toString().matchAll(ICON_CALL)) {
    const url = catalog[match[2] ?? ''];
    const index = match.index;
    if (!url || index == null) {
      continue;
    }
    marks.push(Decoration.widget({ widget: new IconMark(url), side: -1 }).range(index));
  }
  return Decoration.set(marks);
}

const iconCallPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    generation: number;

    constructor(view: EditorView) {
      this.generation = iconCatalogGeneration();
      this.decorations = iconCallDecorations(view);
    }

    update(update: ViewUpdate) {
      const bumped = update.transactions.some((transaction) =>
        transaction.effects.some((effect) => effect.is(iconCatalogChanged)),
      );
      const generation = iconCatalogGeneration();
      if (update.docChanged || update.viewportChanged || bumped || generation !== this.generation) {
        this.generation = generation;
        this.decorations = iconCallDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function iconCompletions(context: CompletionContext): CompletionResult | null {
  const arg = context.matchBefore(ICON_ARG);
  if (arg) {
    const quoteAt = Math.max(arg.text.lastIndexOf("'"), arg.text.lastIndexOf('"'));
    const typed = arg.text.slice(quoteAt + 1);
    const options = Object.keys(getIconCatalog())
      .filter((path) => path.startsWith(typed))
      .sort((a, b) => a.localeCompare(b))
      .map((path) => ({
        label: path,
        type: 'constant' as const,
        detail: '$icon',
      }));
    if (options.length === 0) {
      return null;
    }
    return { from: arg.from + quoteAt + 1, options, validFor: /^[^'"]*$/u };
  }

  const copy = context.matchBefore(T_ARG);
  if (copy) {
    const typed = copy.text.slice(copy.text.lastIndexOf('"') + 1);
    const options = getI18nEntries()
      .filter((entry) => entry.path.startsWith(typed))
      .map((entry) => ({
        label: entry.path,
        type: 'constant' as const,
        detail: entry.text || '$t',
      }));
    if (options.length === 0) {
      return null;
    }
    return { from: copy.from + copy.text.lastIndexOf('"') + 1, options, validFor: /^[^"]*$/u };
  }

  const word = context.matchBefore(/\$[A-Za-z]*/u);
  if (!word || (word.text === '$' && !context.explicit)) {
    return null;
  }
  const options = [];
  if ('$t'.startsWith(word.text)) {
    options.push({
      label: '$t',
      type: 'function' as const,
      detail: '(key: string) => string',
      apply: '$t("',
      boost: 30,
    });
  }
  if ('$icon'.startsWith(word.text)) {
    options.push({
      label: '$icon',
      type: 'function' as const,
      detail: '(path: string) => string',
      apply: "$icon('",
      boost: 30,
    });
  }
  if (options.length === 0) {
    return null;
  }
  return {
    from: word.from,
    options,
    validFor: /^\$[A-Za-z]*$/u,
  };
}

function openIconCompletion() {
  return EditorView.updateListener.of((update) => {
    if (!update.docChanged) {
      return;
    }
    const pos = update.state.selection.main.head;
    const recent = update.state.sliceDoc(Math.max(0, pos - 80), pos);
    if (ICON_ARG.test(recent) || T_ARG.test(recent) || recent.endsWith('$')) {
      startCompletion(update.view);
    }
  });
}

export const iconScriptExtensions: Extension[] = [
  EditorState.languageData.of(() => [{ autocomplete: iconCompletions }]),
  iconCallPlugin,
  openIconCompletion(),
];

export function refreshIconMarks(view: EditorView) {
  view.dispatch({ effects: iconCatalogChanged.of(iconCatalogGeneration()) });
}

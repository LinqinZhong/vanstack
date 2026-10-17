import { startCompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { EditorState, StateEffect, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { getAssetCatalog, assetCatalogGeneration } from './assetCatalog';
import { getIconCatalog, iconCatalogGeneration } from './iconCatalog';
import { getI18nEntries, getI18nText, i18nGeneration } from './i18nRuntime';

const marksChanged = StateEffect.define<number>();

const ICON_CALL = /\$icon\(\s*(['"])([^'"]+)\1\s*\)/g;
const ICON_ARG = /\$icon\(\s*(['"])[^'"]*$/;
const ASSET_CALL = /\$asset\(\s*(['"])([^'"]+)\1\s*\)/g;
const ASSET_ARG = /\$asset\(\s*(['"])[^'"]*$/;
const T_CALL = /(\$t\(\s*)(['"])([^'"]+)\2(\s*\))/g;
const T_ARG = /\$t\(\s*"([^"]*)$/;
const IMAGE_URL = /\.(png|jpe?g|gif|webp|svg|bmp|ico)(\?|#|$)/i;

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

/** 把 $t("分组.条目") 括号内的 key 直接显示成真实文案（过长省略）；光标落进表达式时露出源码。 */
class I18nValue extends WidgetType {
  constructor(private readonly text: string) {
    super();
  }

  eq(other: I18nValue) {
    return other.text === this.text;
  }

  ignoreEvent() {
    return true;
  }

  toDOM() {
    const value = document.createElement('span');
    value.className = 'cm-i18n-value';
    value.textContent = this.text;
    return value;
  }
}

function cursorInside(view: EditorView, from: number, to: number) {
  return view.state.selection.ranges.some((range) => range.from <= to && range.to >= from);
}

function callDecorations(view: EditorView): DecorationSet {
  const icons = getIconCatalog();
  const assets = getAssetCatalog();
  const ranges: Array<{ from: number; to?: number; widget: WidgetType }> = [];
  const text = view.state.doc.toString();
  for (const match of text.matchAll(ICON_CALL)) {
    const url = icons[match[2] ?? ''];
    if (url && match.index != null) {
      ranges.push({ from: match.index, widget: new IconMark(url) });
    }
  }
  for (const match of text.matchAll(ASSET_CALL)) {
    const url = assets[match[2] ?? ''];
    // 只有图片资源才在编辑器里预览，其它文件保持原样。
    if (url && IMAGE_URL.test(url) && match.index != null) {
      ranges.push({ from: match.index, widget: new IconMark(url) });
    }
  }
  for (const match of text.matchAll(T_CALL)) {
    if (match.index == null) {
      continue;
    }
    const content = match[3] ?? '';
    const contentStart = match.index + match[1].length + 1;
    const contentEnd = contentStart + content.length;
    const value = getI18nText(content);
    if (value && !cursorInside(view, match.index, match.index + match[0].length)) {
      ranges.push({ from: contentStart, to: contentEnd, widget: new I18nValue(value) });
    }
  }
  ranges.sort((a, b) => a.from - b.from || (a.to ?? a.from) - (b.to ?? b.from));
  return Decoration.set(
    ranges.map((item) =>
      item.to == null
        ? Decoration.widget({ widget: item.widget, side: -1 }).range(item.from)
        : Decoration.replace({ widget: item.widget }).range(item.from, item.to),
    ),
  );
}

const iconCallPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    iconGeneration: number;
    assetGeneration: number;
    i18nGeneration: number;

    constructor(view: EditorView) {
      this.iconGeneration = iconCatalogGeneration();
      this.assetGeneration = assetCatalogGeneration();
      this.i18nGeneration = i18nGeneration();
      this.decorations = callDecorations(view);
    }

    update(update: ViewUpdate) {
      const bumped = update.transactions.some((transaction) =>
        transaction.effects.some((effect) => effect.is(marksChanged)),
      );
      const iconGeneration = iconCatalogGeneration();
      const assetGeneration = assetCatalogGeneration();
      const i18nGenerationNext = i18nGeneration();
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        bumped ||
        iconGeneration !== this.iconGeneration ||
        assetGeneration !== this.assetGeneration ||
        i18nGenerationNext !== this.i18nGeneration
      ) {
        this.iconGeneration = iconGeneration;
        this.assetGeneration = assetGeneration;
        this.i18nGeneration = i18nGenerationNext;
        this.decorations = callDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function iconCompletions(context: CompletionContext): CompletionResult | null {
  const assetArg = context.matchBefore(ASSET_ARG);
  if (assetArg) {
    const quoteAt = Math.max(assetArg.text.lastIndexOf("'"), assetArg.text.lastIndexOf('"'));
    const typed = assetArg.text.slice(quoteAt + 1);
    const options = Object.keys(getAssetCatalog())
      .filter((path) => path.startsWith(typed))
      .sort((a, b) => a.localeCompare(b))
      .map((path) => ({
        label: path,
        type: 'constant' as const,
        detail: '$asset',
      }));
    if (options.length === 0) {
      return null;
    }
    return { from: assetArg.from + quoteAt + 1, options, validFor: /^[^'"]*$/u };
  }

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
  if ('$asset'.startsWith(word.text)) {
    options.push({
      label: '$asset',
      type: 'function' as const,
      detail: '(path: string) => string',
      apply: "$asset('",
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
    if (ICON_ARG.test(recent) || ASSET_ARG.test(recent) || T_ARG.test(recent) || recent.endsWith('$')) {
      startCompletion(update.view);
    }
  });
}

export const iconScriptExtensions: Extension[] = [
  EditorState.languageData.of(() => [{ autocomplete: iconCompletions }]),
  iconCallPlugin,
  openIconCompletion(),
];

export function refreshScriptMarks(view: EditorView) {
  view.dispatch({ effects: marksChanged.of(iconCatalogGeneration() + assetCatalogGeneration()) });
}

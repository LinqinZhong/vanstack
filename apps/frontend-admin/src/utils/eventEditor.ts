import {
  snippet,
  startCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView, showTooltip } from '@codemirror/view';
import { WIDGET_EVENT_DECLARATIONS } from '@vanstack/xml';
import ts from 'typescript';

export type EventEditorParam = {
  name: string;
  type: string;
};

export type EventEditorCopy = {
  info: string;
  short: string;
  long: string;
  params: EventEditorParam[];
};

const FILE = '/event.ts';
const SIGNATURE = '(text: string, duration?: 0 | 1): void';
const RUNTIME_FUNCTIONS = new Set(['$toast', '$navigateTo', '$navigateBack']);

const libLoaders = import.meta.glob(
  [
    '../../node_modules/typescript/lib/lib.es*.d.ts',
    '../../node_modules/typescript/lib/lib.dom.d.ts',
    '../../node_modules/typescript/lib/lib.dom.iterable.d.ts',
    '../../node_modules/typescript/lib/lib.decorators.d.ts',
    '../../node_modules/typescript/lib/lib.decorators.legacy.d.ts',
  ],
  { query: '?raw', import: 'default' },
);

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  strict: true,
  noEmit: true,
};

let libsPromise: Promise<Map<string, string>> | null = null;
let service: ts.LanguageService | null = null;
let source = '';
let version = 0;

export function createEventEditorExtensions(copy: EventEditorCopy) {
  const language = javascript({ typescript: true });
  return [
    language,
    language.language.data.of({
      autocomplete: (context: CompletionContext) => scriptCompletions(context, copy),
    }),
    openEditorCompletion(),
    toastSignature(),
  ];
}

function openEditorCompletion() {
  return EditorView.updateListener.of((update) => {
    if (!update.docChanged) {
      return;
    }
    const pos = update.state.selection.main.head;
    const typed = update.state.sliceDoc(Math.max(0, pos - 1), pos);
    if (typed === '.' || typed === '$') {
      startCompletion(update.view);
    }
  });
}

async function scriptCompletions(context: CompletionContext, copy: EventEditorCopy): Promise<CompletionResult | null> {
  const libs = await loadLibs();
  const languageService = ensureService(libs);
  const body = context.state.doc.toString();
  const header = virtualHeader(copy.params);
  const nextSource = `${header}${body}\n}\n`;
  if (nextSource !== source) {
    source = nextSource;
    version += 1;
  }
  const position = header.length + context.pos;
  let result: ts.WithMetadata<ts.CompletionInfo> | undefined;
  try {
    result = languageService.getCompletionsAtPosition(FILE, position, {
      includeCompletionsForModuleExports: false,
      includeCompletionsWithInsertText: true,
      allowIncompleteCompletions: true,
      triggerCharacter: body[context.pos - 1] === '.' ? '.' : undefined,
    });
  } catch {
    result = undefined;
  }
  const call = toastCallAt(body, context.pos);
  const options = result ? completionOptions(languageService, result, position, header.length, context.pos, copy) : [];
  if (call?.argIndex === 1 && /^\d*$/u.test(body.slice(call.from, context.pos))) {
    pushDuration(options, copy);
  }
  if (options.length === 0) {
    return null;
  }
  const span = result?.optionalReplacementSpan;
  const spanStart = span ? span.start - header.length : -1;
  const word = context.matchBefore(/[\w$]+/u);
  const from = spanStart >= 0 && spanStart <= context.pos ? spanStart : (word?.from ?? context.pos);
  return {
    from,
    to: spanStart >= 0 && span ? spanStart + span.length : undefined,
    options,
    validFor: /^[\w$]*$/u,
  };
}

function completionOptions(
  languageService: ts.LanguageService,
  result: ts.CompletionInfo,
  position: number,
  headerLength: number,
  cursor: number,
  copy: EventEditorCopy,
): Completion[] {
  const detailed = result.isMemberCompletion && result.entries.length <= 80;
  const options: Completion[] = [];
  for (const entry of result.entries) {
    if (entry.name === 'handler' || entry.isPackageJsonImport || entry.isImportStatementCompletion) {
      continue;
    }
    const spanStart = entry.replacementSpan ? entry.replacementSpan.start - headerLength : -1;
    if (entry.replacementSpan && (spanStart < 0 || spanStart > cursor)) {
      continue;
    }
    const signature = detailed ? completionSignature(languageService, entry, position) : '';
    options.push({
      label: entry.filterText || entry.name,
      type: completionType(entry.kind),
      detail: entry.name === '$toast' ? SIGNATURE : signature || entry.labelDetails?.detail,
      boost: entry.isRecommended || RUNTIME_FUNCTIONS.has(entry.name) || entry.name === '$query' ? 20 : 0,
      info:
        entry.name === '$toast'
          ? copy.info
          : () => completionInfo(languageService, entry, position, signature),
      apply: completionApply(entry, result.isMemberCompletion),
    });
  }
  return options;
}

function pushDuration(options: Completion[], copy: EventEditorCopy) {
  const present = new Set(options.map((option) => option.label));
  const extra: Completion[] = [
    { label: '0', type: 'constant', detail: copy.short, boost: 30 },
    { label: '1', type: 'constant', detail: copy.long, boost: 30 },
  ];
  for (const option of extra) {
    if (!present.has(option.label)) {
      options.unshift(option);
    }
  }
}

function completionApply(entry: ts.CompletionEntry, member: boolean): Completion['apply'] {
  if (!member && RUNTIME_FUNCTIONS.has(entry.name)) {
    return `${entry.name}(`;
  }
  if (entry.isSnippet && entry.insertText) {
    return snippet(entry.insertText);
  }
  return entry.insertText || entry.name;
}

function completionSignature(languageService: ts.LanguageService, entry: ts.CompletionEntry, position: number) {
  try {
    const details = languageService.getCompletionEntryDetails(
      FILE,
      position,
      entry.name,
      undefined,
      entry.source,
      undefined,
      entry.data,
    );
    return details?.displayParts.map((part) => part.text).join('') ?? '';
  } catch {
    return '';
  }
}

function completionInfo(
  languageService: ts.LanguageService,
  entry: ts.CompletionEntry,
  position: number,
  knownSignature: string,
) {
  const signature = knownSignature || completionSignature(languageService, entry, position);
  const details = signature
    ? undefined
    : safeDetails(languageService, entry, position);
  const documentation = details?.documentation?.map((part) => part.text).join('') ?? '';
  const text = [signature, documentation].filter(Boolean).join('\n');
  if (!text) {
    return null;
  }
  const dom = document.createElement('div');
  dom.className = 'event-completion-info';
  dom.textContent = text;
  return dom;
}

function safeDetails(languageService: ts.LanguageService, entry: ts.CompletionEntry, position: number) {
  try {
    return languageService.getCompletionEntryDetails(
      FILE,
      position,
      entry.name,
      undefined,
      entry.source,
      undefined,
      entry.data,
    );
  } catch {
    return undefined;
  }
}

function completionType(kind: string) {
  switch (kind) {
    case 'method':
    case 'getter':
    case 'setter':
      return 'method';
    case 'function':
    case 'local function':
    case 'constructor':
      return 'function';
    case 'property':
      return 'property';
    case 'class':
    case 'local class':
      return 'class';
    case 'interface':
      return 'interface';
    case 'enum':
    case 'enum member':
      return 'enum';
    case 'keyword':
      return 'keyword';
    case 'const':
      return 'constant';
    case 'type':
    case 'alias':
    case 'primitive type':
    case 'type parameter':
      return 'type';
    case 'module':
      return 'namespace';
    default:
      return 'variable';
  }
}

function virtualHeader(params: EventEditorParam[]) {
  const args = params.map((param) => `${param.name}: ${param.type}`).join(', ');
  return `${WIDGET_EVENT_DECLARATIONS}
declare function $toast(text: string, duration?: 0 | 1): void
/** 返回上一层或多层。1 是上一页，更大的数字继续往前，停在本次打开时的首页。 */
declare function $navigateBack(times?: number): void
/** 打开指定页面，并带上查询参数。页面里用 $query.参数名 读取。 */
declare function $navigateTo(pageKey: string, query?: Record<string, any>): void
/** 当前页的查询参数。 */
declare const $query: Record<string, any>
function handler(${args}) {\n`;
}

function loadLibs() {
  if (!libsPromise) {
    libsPromise = Promise.all(
      Object.entries(libLoaders).map(async ([file, load]) => {
        const text = await load();
        return [file.slice(file.lastIndexOf('/') + 1), String(text)] as const;
      }),
    ).then((entries) => new Map(entries));
  }
  return libsPromise;
}

function ensureService(libs: Map<string, string>) {
  if (service) {
    return service;
  }
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => compilerOptions,
    getScriptFileNames: () => [FILE],
    getScriptVersion: (file) => (file.endsWith('event.ts') ? String(version) : '0'),
    getScriptSnapshot: (file) => {
      const text = file.endsWith('event.ts') ? source : libs.get(file.slice(file.lastIndexOf('/') + 1));
      return text == null ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => '/',
    getDefaultLibFileName: () => '/lib.es2022.d.ts',
    fileExists: (file) => file.endsWith('event.ts') || libs.has(file.slice(file.lastIndexOf('/') + 1)),
    readFile: (file) => (file.endsWith('event.ts') ? source : libs.get(file.slice(file.lastIndexOf('/') + 1))),
    directoryExists: () => true,
  };
  service = ts.createLanguageService(host, ts.createDocumentRegistry());
  return service;
}

function toastSignature() {
  return showTooltip.compute(['doc', 'selection'], (state) => {
    const pos = state.selection.main.head;
    const call = toastCallAt(state.doc.toString(), pos);
    if (!call) {
      return null;
    }
    return {
      pos: call.open + 1,
      above: true,
      create() {
        const dom = document.createElement('div');
        dom.className = 'event-toast-hint';
        dom.append('$toast(');
        dom.append(argLabel('text: string', call.argIndex === 0));
        dom.append(', ');
        dom.append(argLabel('duration?: 0 | 1', call.argIndex === 1));
        dom.append('): void');
        return { dom };
      },
    };
  });
}

function argLabel(text: string, active: boolean) {
  const node = document.createElement('span');
  node.textContent = text;
  if (active) {
    node.className = 'is-active';
  }
  return node;
}

function toastCallAt(text: string, pos: number): { open: number; argIndex: number; from: number } | null {
  const open = text.lastIndexOf('$toast(', pos);
  if (open < 0) {
    return null;
  }
  let depth = 1;
  let argIndex = 0;
  let from = open + '$toast('.length;
  for (let index = from; index < pos; index += 1) {
    const char = text[index];
    if (char === '(' || char === '[' || char === '{') {
      depth += 1;
    } else if (char === ')' || char === ']' || char === '}') {
      depth -= 1;
      if (depth === 0) {
        return null;
      }
    } else if (char === ',' && depth === 1) {
      argIndex += 1;
      from = index + 1;
    }
  }
  if (depth < 1 || argIndex > 1) {
    return null;
  }
  while (from < pos && /\s/u.test(text[from] ?? '')) {
    from += 1;
  }
  return { open, argIndex, from };
}

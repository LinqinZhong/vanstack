import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import type { Locale } from '@vanstack/shared';
import { isLocale } from '@vanstack/shared';
import { XmlParseError } from './errors';

export { XmlParseError } from './errors';
export {
  EMPTY_PAGE_XML,
  FLEX_ALIGN_CONTENTS,
  FLEX_ALIGN_ITEMS,
  FLEX_ALIGN_SELFS,
  FLEX_DIRECTIONS,
  FLEX_DISPLAYS,
  FLEX_JUSTIFY_CONTENTS,
  FLEX_WRAPS,
  PAGE_DATA_TYPES,
  PAGE_I18N_DIRS,
  POSITION_MODES,
  ANGLE_UNITS,
  BOX_LENGTH_MODES,
  SIZE_MODES,
  SWIPER_EASINGS,
  angleCss,
  boxLengthCss,
  boxLengthsEqual,
  compactAngle,
  compactBoxLength,
  convertAngle,
  compactFlexContainer,
  compactFlexItem,
  compactPageI18n,
  compactPageStyle,
  compactSize,
  compactSwiper,
  compactWidgetStyle,
  DEFAULT_SWIPER_HEIGHT,
  DEFAULT_SWIPER_WIDTH,
  formatAngle,
  formatBoxLength,
  formatI18nCopy,
  isI18nKey,
  pageI18nDir,
  parseAngle,
  parseBoxLength,
  parsePageXml,
  pickPageLocale,
  resolveI18nCopy,
  resolveWidgetState,
  resolveWidgetStateStack,
  resolveWidgetTree,
  diffWidgetState,
  findOwnedDelta,
  hasOwnedStates,
  appliedStateName,
  nestedAppliedStateName,
  ownedStateNames,
  serializePageXml,
  sanitizeWidgetStyle,
  isPageLangSnapshot,
  pageI18nFromSnapshot,
  type FlexAlignContent,
  type FlexAlignItems,
  type FlexAlignSelf,
  type FlexContainerStyle,
  type FlexDirection,
  type FlexDisplay,
  type FlexItemStyle,
  type FlexJustifyContent,
  type FlexWrap,
  type PageDataType,
  type PageI18n,
  type PageI18nDir,
  type PageI18nEntry,
  type PageI18nGroup,
  type PageI18nLang,
  type PageLangSnapshot,
  type PageStyle,
  type PageVariable,
  type PageWidget,
  type PageXmlDocument,
  type WidgetStateDelta,
  type WidgetStateFields,
  type WidgetStateLayer,
  type WidgetStateRole,
  type WidgetStateViewing,
  type AngleUnit,
  type AngleValue,
  type BoxLength,
  type BoxLengthMode,
  type PositionMode,
  type SizeMode,
  type SizeValue,
  type SwiperEasing,
  type SwiperStyle,
  type WidgetPosition,
  type WidgetStyle,
} from './page';

type DocumentXmlPayload = {
  documents: Array<{
    title: string;
    summary?: string;
    content?: string;
    locale?: Locale;
  }>;
};

type DocumentRecord = {
  id: string;
  title: string;
  summary: string;
  content: string;
  locale: Locale;
  createdAt: string;
  updatedAt: string;
  files: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
  }>;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  isArray: (name) => name === 'document',
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  indentBy: '  ',
  suppressEmptyNode: true,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function parseDocumentsXml(xml: string): DocumentXmlPayload {
  const result = XMLValidator.validate(xml);
  if (result !== true) {
    throw new XmlParseError(result.err.msg);
  }

  const parsed = parser.parse(xml) as {
    documents?: { document?: unknown };
    document?: unknown;
  };

  const rawDocuments = asArray(parsed.documents?.document ?? parsed.document);

  const documents = rawDocuments.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const title = String(row.title ?? '').trim();
    if (!title) {
      throw new XmlParseError('Each document requires a title');
    }

    const localeValue = String(row.locale ?? 'zh');
    const locale: Locale = isLocale(localeValue) ? localeValue : 'zh';

    return {
      title,
      summary: row.summary ? String(row.summary) : '',
      content: row.content ? String(row.content) : '',
      locale,
    };
  });

  if (documents.length === 0) {
    throw new XmlParseError('XML does not contain any documents');
  }

  return { documents };
}

export function serializeDocumentsXml(documents: DocumentRecord[]): string {
  const payload = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    documents: {
      document: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        summary: doc.summary,
        content: doc.content,
        locale: doc.locale,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        files: {
          file: doc.files.map((file) => ({
            id: file.id,
            originalName: file.originalName,
            mimeType: file.mimeType,
            size: file.size,
            url: file.url,
          })),
        },
      })),
    },
  };

  return builder.build(payload);
}

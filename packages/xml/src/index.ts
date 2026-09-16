import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import type { DocumentDto, DocumentXmlPayload, Locale } from '@vanstack/shared';
import { isLocale } from '@vanstack/shared';

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

export class XmlParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XmlParseError';
  }
}

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

export function serializeDocumentsXml(documents: DocumentDto[]): string {
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

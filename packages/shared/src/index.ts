export const LOCALES = ['zh', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'zh';

export function isLocale(value: string): value is Locale {
  return LOCALES.includes(value as Locale);
}

export interface DocumentFileDto {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  documentId?: string | null;
  createdAt: string;
}

export interface DocumentDto {
  id: string;
  title: string;
  summary: string;
  content: string;
  locale: Locale;
  files: DocumentFileDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentInput {
  title: string;
  summary?: string;
  content?: string;
  locale?: Locale;
}

export interface UpdateDocumentInput {
  title?: string;
  summary?: string;
  content?: string;
  locale?: Locale;
}

export interface DocumentXmlPayload {
  documents: Array<{
    title: string;
    summary?: string;
    content?: string;
    locale?: Locale;
  }>;
}

export interface HealthDto {
  ok: true;
  service: string;
  timestamp: string;
}

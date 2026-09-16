export const LOCALES = ['zh', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'zh';

export function isLocale(value: string): value is Locale {
  return LOCALES.includes(value as Locale);
}

export interface HealthDto {
  ok: true;
  service: string;
  timestamp: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthUserDto {
  id: string;
  username: string;
  roles: string[];
  permissions: string[];
}

export interface AuthSessionDto {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: AuthUserDto;
}

import { Controller, Get } from '@nestjs/common';
import { I18n, I18nContext } from 'nestjs-i18n';

@Controller('health')
export class HealthController {
  @Get()
  health(@I18n() i18n: I18nContext) {
    return {
      ok: true,
      service: i18n.t('common.app'),
      timestamp: new Date().toISOString(),
    };
  }
}

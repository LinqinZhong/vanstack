import { Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import type { AuthSessionDto, AuthUserDto } from '@vanstack/shared';
import { I18n, I18nContext } from 'nestjs-i18n';
import { AuthService } from './auth.service';
import type { AuthPrincipal } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { RequirePermissions } from './decorators/require-permissions.decorator';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @I18n() i18n: I18nContext): Promise<AuthSessionDto> {
    try {
      return await this.auth.login(dto.username, dto.password);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw new UnauthorizedException(i18n.t('messages.auth.invalidCredentials'));
      }
      throw error;
    }
  }

  @Get('me')
  me(@CurrentUser() user: AuthPrincipal | undefined): Promise<AuthUserDto> {
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.auth.profile(user.id);
  }

  @Get('permission-check')
  @RequirePermissions('system:admin')
  permissionCheck() {
    return { ok: true };
  }
}

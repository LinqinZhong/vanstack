import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthPrincipal } from '../auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPrincipal | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthPrincipal }>();
    return request.user;
  },
);

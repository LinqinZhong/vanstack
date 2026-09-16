import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'requirePermissions';

export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

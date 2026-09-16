import type { AuthUserDto } from '@vanstack/shared';
import type { SysUser } from './entities/sys-user.entity';

export function collectGrants(user: SysUser): Pick<AuthUserDto, 'roles' | 'permissions'> {
  const roles = (user.roles ?? []).map((role) => role.code);
  const permissions = [...new Set((user.roles ?? []).flatMap((role) => role.permissions ?? []))];
  return { roles, permissions };
}

export function toAuthUser(user: SysUser): AuthUserDto {
  const grants = collectGrants(user);
  return {
    id: user.id,
    username: user.username,
    roles: grants.roles,
    permissions: grants.permissions,
  };
}

export function hasPermissions(granted: string[], required: string[]): boolean {
  if (granted.includes('*')) {
    return true;
  }
  return required.every((permission) => granted.includes(permission));
}

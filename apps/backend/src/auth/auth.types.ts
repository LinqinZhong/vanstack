export type JwtPayload = {
  sub: string;
  username: string;
  roles: string[];
  permissions: string[];
};

export type AuthPrincipal = {
  id: string;
  username: string;
  roles: string[];
  permissions: string[];
};

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import type { AuthPrincipal, JwtPayload } from './auth.types';
import { collectGrants } from './auth.util';
import { SysUser } from './entities/sys-user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(SysUser) private readonly users: Repository<SysUser>,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is required');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthPrincipal> {
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user || user.status !== 'enabled') {
      throw new UnauthorizedException();
    }

    const grants = collectGrants(user);
    return {
      id: user.id,
      username: user.username,
      roles: grants.roles,
      permissions: grants.permissions,
    };
  }
}

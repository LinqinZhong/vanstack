import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import type { AuthSessionDto, AuthUserDto } from '@vanstack/shared';
import type { JwtPayload } from './auth.types';
import { toAuthUser } from './auth.util';
import { SysRole } from './entities/sys-role.entity';
import { SysUser } from './entities/sys-user.entity';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    @InjectRepository(SysUser) private readonly users: Repository<SysUser>,
    @InjectRepository(SysRole) private readonly roles: Repository<SysRole>,
  ) {}

  async onModuleInit() {
    await this.seedIfEmpty();
  }

  async login(username: string, password: string): Promise<AuthSessionDto> {
    const user = await this.users.findOne({ where: { username } });
    if (!user || user.status !== 'enabled') {
      throw new UnauthorizedException();
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException();
    }

    return this.issueSession(user);
  }

  async profile(userId: string): Promise<AuthUserDto> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.status !== 'enabled') {
      throw new UnauthorizedException();
    }
    return toAuthUser(user);
  }

  private async issueSession(user: SysUser): Promise<AuthSessionDto> {
    const authUser = toAuthUser(user);
    const payload: JwtPayload = {
      sub: authUser.id,
      username: authUser.username,
      roles: authUser.roles,
      permissions: authUser.permissions,
    };
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN', '8h');
    const accessToken = await this.jwt.signAsync(payload);
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: authUser,
    };
  }

  private async seedIfEmpty() {
    const count = await this.users.count();
    if (count > 0) {
      return;
    }

    const username = this.config.get<string>('ADMIN_SEED_USERNAME');
    const password = this.config.get<string>('ADMIN_SEED_PASSWORD');
    if (!username || !password) {
      throw new Error('ADMIN_SEED_USERNAME and ADMIN_SEED_PASSWORD are required to seed admin');
    }

    const role = this.roles.create({
      code: 'admin',
      name: 'Administrator',
      permissions: ['*'],
    });
    await this.roles.save(role);

    const user = this.users.create({
      username,
      passwordHash: await bcrypt.hash(password, 10),
      status: 'enabled',
      roles: [role],
    });
    await this.users.save(user);
  }
}

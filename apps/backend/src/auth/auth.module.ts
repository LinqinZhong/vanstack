import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { SignOptions } from 'jsonwebtoken';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SysRole } from './entities/sys-role.entity';
import { SysUser } from './entities/sys-user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([SysUser, SysRole]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is required');
        }
        if (config.get<string>('NODE_ENV') === 'production' && secret === 'change-me') {
          throw new Error('JWT_SECRET must be set to a strong value in production');
        }
        return {
          secret,
          signOptions: {
            expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '8h') as SignOptions['expiresIn'],
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}

import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { LowcodeModule } from './lowcode/lowcode.module';
import { OssModule } from './oss/oss.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    I18nModule.forRoot({
      fallbackLanguage: process.env.FALLBACK_LANGUAGE ?? 'en',
      loaderOptions: {
        path: join(__dirname, 'i18n'),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        new HeaderResolver(['x-lang']),
        AcceptLanguageResolver,
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const dbType = config.get<string>('DB_TYPE', 'sqlite');
        const common = {
          autoLoadEntities: true,
          synchronize: config.get<string>('NODE_ENV') !== 'production',
        };

        if (dbType === 'postgres') {
          return {
            type: 'postgres' as const,
            host: config.get<string>('DB_HOST', '127.0.0.1'),
            port: Number(config.get('DB_PORT', 5432)),
            username: config.get<string>('DB_USER', 'vanstack'),
            password: config.get<string>('DB_PASSWORD', 'vanstack'),
            database: config.get<string>('DB_NAME', 'vanstack'),
            ...common,
          };
        }

        if (dbType === 'mysql') {
          return {
            type: 'mysql' as const,
            host: config.get<string>('DB_HOST', '127.0.0.1'),
            port: Number(config.get('DB_PORT', 3306)),
            username: config.get<string>('DB_USER', 'root'),
            password: config.get<string>('DB_PASSWORD', 'vanstack'),
            database: config.get<string>('DB_NAME', 'vanstack'),
            ...common,
          };
        }

        return {
          type: 'better-sqlite3' as const,
          database: config.get<string>('DB_PATH', 'data/vanstack.sqlite'),
          autoLoadEntities: true,
          synchronize: true,
        };
      },
    }),
    OssModule,
    AuthModule,
    HealthModule,
    LowcodeModule,
  ],
})
export class AppModule {}

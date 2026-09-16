import 'reflect-metadata';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, text, urlencoded } from 'express';
import { AppModule } from './app.module';
import { XmlResponseInterceptor } from './common/xml-response.interceptor';

function ensureLocalDirs() {
  mkdirSync(dirname(process.env.DB_PATH ?? 'data/vanstack.sqlite'), { recursive: true });
  mkdirSync(process.env.OSS_LOCAL_DIR ?? 'uploads', { recursive: true });
}

async function bootstrap() {
  ensureLocalDirs();
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(json({ limit: '4mb' }));
  app.use(urlencoded({ extended: true, limit: '4mb' }));
  app.use(text({ type: ['application/xml', 'text/xml'], limit: '4mb' }));

  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new XmlResponseInterceptor());

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();

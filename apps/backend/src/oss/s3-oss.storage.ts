import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OssStorage, StoredObject } from './oss.types';

@Injectable()
export class S3OssStorage extends OssStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    super();
    this.bucket = config.get<string>('OSS_BUCKET', 'vanstack');
    this.publicUrl = config.get<string>('OSS_PUBLIC_URL') ?? '';

    this.client = new S3Client({
      region: config.get<string>('OSS_REGION', 'us-east-1'),
      endpoint: config.get<string>('OSS_ENDPOINT'),
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.get<string>('OSS_ACCESS_KEY', 'vanstack'),
        secretAccessKey: config.get<string>('OSS_SECRET_KEY', 'vanstack_secret'),
      },
    });
  }

  async ensureReady(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
    await this.client
      .send(
        new PutBucketCorsCommand({
          Bucket: this.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'HEAD'],
                AllowedOrigins: ['*'],
                ExposeHeaders: ['ETag', 'Content-Type'],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        }),
      )
      .catch(() => undefined);
    await this.client
      .send(
        new PutBucketPolicyCommand({
          Bucket: this.bucket,
          Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'PublicReadLowcodeXml',
                Effect: 'Allow',
                Principal: { AWS: ['*'] },
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${this.bucket}/lowcode/*`],
              },
            ],
          }),
        }),
      )
      .catch(() => undefined);
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );

    return { key, url: this.getPublicUrl(key) };
  }

  async getObject(key: string) {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) {
        return null;
      }
      return {
        body: Buffer.from(bytes),
        contentType: result.ContentType ?? 'application/octet-stream',
      };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  getPublicUrl(key: string): string {
    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/$/, '')}/${key}`;
    }
    return `/api/files/content/${encodeURIComponent(key)}`;
  }
}

import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { GridFSBucket, MongoClient } from 'mongodb';

const bucketName = process.env.OSS_BUCKET || 'vanstack';
const publicBases = [
  process.env.OSS_PUBLIC_URL,
  'http://127.0.0.1:9000/vanstack',
  'http://localhost:9000/vanstack',
].filter(Boolean);
const appPublic = (process.env.APP_PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const mongoDb = process.env.MONGO_DB || 'vanstack';

const s3 = new S3Client({
  region: process.env.OSS_REGION || 'us-east-1',
  endpoint: process.env.OSS_ENDPOINT || 'http://127.0.0.1:9000',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.OSS_ACCESS_KEY || 'neweb',
    secretAccessKey: process.env.OSS_SECRET_KEY || 'Aa123456',
  },
});

function publicUrl(key) {
  return `${appPublic}/api/files/content/${encodeURIComponent(key)}`;
}

function rewrite(text) {
  let next = text;
  for (const base of publicBases) {
    const prefix = `${String(base).replace(/\/$/, '')}/`;
    const pattern = new RegExp(`${escapeRegExp(prefix)}([^\\s"'<>]+)`, 'g');
    next = next.replace(pattern, (_match, rawKey) => {
      let key = rawKey;
      try {
        key = decodeURIComponent(rawKey);
      } catch {
        key = rawKey;
      }
      return publicUrl(key);
    });
  }
  return next;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listKeys() {
  const keys = [];
  let token;
  do {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: token,
      }),
    );
    for (const object of result.Contents ?? []) {
      if (object.Key) {
        keys.push(object.Key);
      }
    }
    token = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function readObject(key) {
  const result = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
  const bytes = await result.Body?.transformToByteArray();
  return {
    body: Buffer.from(bytes ?? []),
    contentType: result.ContentType || 'application/octet-stream',
  };
}

async function main() {
  const keys = await listKeys();
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(mongoDb);
  const bucket = new GridFSBucket(db, { bucketName: 'objects' });
  await db.collection('objects.files').createIndex({ filename: 1 });

  let rewritten = 0;
  for (const key of keys) {
    const object = await readObject(key);
    let body = object.body;
    const textual = /xml|json|text|svg/.test(object.contentType) || /\.(xml|json|svg|txt)$/i.test(key);
    if (textual) {
      const text = body.toString('utf8');
      const next = rewrite(text);
      if (next !== text) {
        body = Buffer.from(next, 'utf8');
        rewritten += 1;
      }
    }
    const existing = await bucket.find({ filename: key }).toArray();
    for (const file of existing) {
      await bucket.delete(file._id);
    }
    await new Promise((resolve, reject) => {
      const stream = bucket.openUploadStream(key, { metadata: { contentType: object.contentType } });
      stream.on('error', reject);
      stream.on('finish', resolve);
      stream.end(body);
    });
  }

  const count = await db.collection('objects.files').countDocuments();
  console.log(`migrated ${keys.length} objects, rewrote ${rewritten} text files, mongo files=${count}`);
  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

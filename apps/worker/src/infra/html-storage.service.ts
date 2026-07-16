import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

/**
 * Stores raw and normalized HTML bodies in object storage, keyed by content
 * hash so identical bodies dedupe. PostgreSQL keeps only the hash pointer
 * (docs/02 §3 D3).
 */
@Injectable()
export class HtmlStorageService {
  private readonly logger = new Logger(HtmlStorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;

  constructor(config: ConfigService<Env, true>) {
    const endpoint = config.get('S3_ENDPOINT', { infer: true });
    const accessKey = config.get('S3_ACCESS_KEY', { infer: true });
    this.bucket = config.get('S3_BUCKET_HTML', { infer: true });
    // No credentials configured ⇒ storage disabled. Extracted artifacts still
    // persist in PostgreSQL; only the raw-body archive is skipped.
    if (!accessKey) {
      this.client = null;
      this.logger.warn(
        'object storage disabled (no S3 credentials); raw HTML will not be archived',
      );
    } else {
      this.client = new S3Client({
        region: config.get('S3_REGION', { infer: true }),
        ...(endpoint ? { endpoint } : {}),
        forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
        maxAttempts: 2,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: config.get('S3_SECRET_KEY', { infer: true }),
        },
      });
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  key(kind: 'raw' | 'normalized', contentHashHex: string): string {
    return `${kind}/${contentHashHex.slice(0, 2)}/${contentHashHex}.html`;
  }

  async put(
    kind: 'raw' | 'normalized',
    contentHashHex: string,
    body: Buffer,
  ): Promise<string | null> {
    if (!this.client) return null;
    const key = this.key(kind, contentHashHex);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: 'text/html' }),
    );
    return key;
  }

  async get(key: string): Promise<Buffer | null> {
    if (!this.client) return null;
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await res.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch (err) {
      this.logger.warn({ err, key }, 'html fetch from storage failed');
      return null;
    }
  }
}

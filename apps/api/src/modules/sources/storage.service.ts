import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@seo-guardian/shared';
import type { Env } from '../../config/env';

/** Object storage for uploaded CSVs (MinIO locally, S3 in production). */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService<Env, true>) {
    const endpoint = config.get('S3_ENDPOINT', { infer: true });
    this.bucket = config.get('S3_BUCKET_UPLOADS', { infer: true });
    this.client = new S3Client({
      region: config.get('S3_REGION', { infer: true }),
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_KEY', { infer: true }),
      },
    });
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (err) {
      this.logger.error({ err, key }, 'object storage write failed');
      throw new ServiceUnavailableException({
        code: ERROR_CODES.INTERNAL,
        message: 'File storage is unavailable; try again shortly',
      });
    }
  }

  /** Best effort: a dangling object is preferable to failing the user's delete. */
  async deleteObjectSafe(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.warn({ err, key }, 'object storage delete failed (ignored)');
    }
  }
}

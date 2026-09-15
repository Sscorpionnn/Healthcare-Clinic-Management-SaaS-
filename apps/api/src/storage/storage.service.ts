import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

/**
 * Thin S3-compatible object storage wrapper (MinIO locally). Implements the
 * two-phase upload flow from docs/document-security.md: the API never
 * proxies file bytes for the happy path — it mints signed URLs and, at
 * `/complete`, reads the object back once to verify it before promoting it
 * out of quarantine.
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly privateBucket: string;
  private readonly quarantineBucket: string;
  private readonly signedUrlTtlSeconds: number;

  constructor(private readonly config: ConfigService) {
    const endpoint = `${this.config.get("STORAGE_USE_SSL") === "true" ? "https" : "http"}://${config.getOrThrow("STORAGE_ENDPOINT")}:${config.getOrThrow("STORAGE_PORT")}`;
    this.client = new S3Client({
      endpoint,
      region: "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.getOrThrow("STORAGE_ACCESS_KEY"),
        secretAccessKey: config.getOrThrow("STORAGE_SECRET_KEY"),
      },
    });
    this.privateBucket = config.getOrThrow("STORAGE_BUCKET_PRIVATE");
    this.quarantineBucket = config.getOrThrow("STORAGE_BUCKET_QUARANTINE");
    this.signedUrlTtlSeconds = Number(
      config.get("STORAGE_SIGNED_URL_TTL_SECONDS", "300"),
    );
  }

  /** Server-generated key — never derived from client-supplied filename (path traversal is structurally impossible). */
  generateObjectKey(clinicId: string): string {
    return `${clinicId}/${randomUUID()}`;
  }

  async presignQuarantineUploadUrl(
    key: string,
    contentType: string,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.quarantineBucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: this.signedUrlTtlSeconds,
    });
  }

  async presignPrivateDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.privateBucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: this.signedUrlTtlSeconds,
    });
  }

  /**
   * Downloads a quarantined object in full for verification (magic-byte
   * sniffing, checksum, exact size) before it can ever be promoted — see
   * docs/document-security.md. Documents are capped at
   * `MAX_DOCUMENT_SIZE_BYTES` (15 MB), so buffering the whole object here
   * is a deliberate, bounded tradeoff in exchange for an exact checksum and
   * size instead of a heuristic based on a partial read.
   */
  async downloadQuarantineObject(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.quarantineBucket,
      Key: key,
    });
    const response = await this.client.send(command);
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /** Promotes a validated object from quarantine to the private bucket, then removes the quarantine copy. */
  async promoteToPrivate(key: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.privateBucket,
        Key: key,
        CopySource: `/${this.quarantineBucket}/${encodeURIComponent(key)}`,
      }),
    );
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.quarantineBucket, Key: key }),
    );
  }

  async deleteFromQuarantine(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.quarantineBucket, Key: key }),
    );
  }

  async deleteFromPrivate(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.privateBucket, Key: key }),
    );
  }
}

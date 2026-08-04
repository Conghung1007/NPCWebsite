import { r2Manager, EXTERNAL_R2_CONFIGS } from "./r2Config";
import {
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

export interface MediaUploadConfig {
  provider: "primary" | "secondary";
  folder: string;
  allowedTypes: string[];
  maxSizeBytes: number;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  provider?: string;
  error?: string;
}

export interface FileInfo {
  name: string;
  /** Full object key in the bucket (folder/filename) */
  key: string;
  url: string;
  lastModified: string;
  size: number;
}

export class MultiR2StorageService {
  // Get upload URL for different providers
  async getUploadUrl(config: MediaUploadConfig, contentType?: string): Promise<UploadResult> {
    const fileId = randomUUID();
    const fileName = `${config.folder}/${fileId}`;

    try {
      return await this.getExternalR2UploadUrl(config.provider, fileName, contentType);
    } catch (error) {
      console.error("Error getting upload URL:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async getExternalR2UploadUrl(
    provider: string,
    fileName: string,
    contentType?: string,
  ): Promise<UploadResult> {
    try {
      const uploadUrl = await r2Manager.generateUploadUrl(
        provider,
        fileName,
        3600,
        contentType,
      );

      if (!uploadUrl) {
        return {
          success: false,
          error: `Failed to generate upload URL for provider: ${provider}`,
        };
      }

      const config = EXTERNAL_R2_CONFIGS[provider];
      const publicUrl = `${config.endpoint}/${config.bucketName}/${fileName}`;

      return {
        success: true,
        url: uploadUrl,
        path: publicUrl,
        provider: provider,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "External R2 upload URL generation failed",
      };
    }
  }

  async testAllConnections(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    const externalConfigs = r2Manager.getAvailableConfigs();
    for (const configName of externalConfigs) {
      results[configName] = await r2Manager.testConnection(configName);
    }
    return results;
  }

  getAvailableProviders(): Array<{
    id: string;
    name: string;
    status: "available" | "configured" | "missing";
  }> {
    return Object.keys(EXTERNAL_R2_CONFIGS).map((configName) => {
      const config = EXTERNAL_R2_CONFIGS[configName];
      const isConfigured = !!(
        config.accessKeyId &&
        config.secretAccessKey &&
        config.bucketName
      );
      return {
        id: configName,
        name: `Cloudflare R2 (${configName})`,
        status: (isConfigured ? "available" : "missing") as
          | "available"
          | "configured"
          | "missing",
      };
    });
  }

  async getDownloadUrl(provider: string, fileName: string): Promise<string | null> {
    try {
      const config = EXTERNAL_R2_CONFIGS[provider];
      if (!config || !config.bucketName) {
        return null;
      }
      return await r2Manager.generateDownloadUrl(provider, fileName);
    } catch (error) {
      console.error(`Error generating download URL:`, error);
      return null;
    }
  }

  /** List objects under a prefix (single page, for UI). */
  async listFiles(provider: string, prefix: string = ""): Promise<FileInfo[]> {
    const objects = await this.listAllObjects(provider, prefix, 100);
    return objects.map((obj) => ({
      name: obj.key.split("/").pop() || obj.key,
      key: obj.key,
      url: `/api/proxy-image/${provider}/${obj.key}`,
      lastModified: obj.lastModified.toISOString(),
      size: obj.size,
    }));
  }

  /** Paginated list of all objects under a prefix. */
  async listAllObjects(
    provider: string,
    prefix: string = "",
    maxKeysPerPage = 500,
  ): Promise<Array<{ key: string; lastModified: Date; size: number }>> {
    try {
      const config = EXTERNAL_R2_CONFIGS[provider];
      if (!config) {
        throw new Error(`Provider ${provider} not found`);
      }

      const client = r2Manager.getClient(provider);
      if (!client) {
        throw new Error(`Client for provider ${provider} not available`);
      }

      const results: Array<{ key: string; lastModified: Date; size: number }> = [];
      let continuationToken: string | undefined;

      do {
        const response = await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucketName,
            Prefix: prefix,
            MaxKeys: maxKeysPerPage,
            ContinuationToken: continuationToken,
          }),
        );

        for (const obj of response.Contents || []) {
          if (!obj.Key || obj.Key.endsWith("/") || !obj.Size) continue;
          results.push({
            key: obj.Key,
            lastModified: obj.LastModified || new Date(0),
            size: obj.Size,
          });
        }

        continuationToken = response.IsTruncated
          ? response.NextContinuationToken
          : undefined;
      } while (continuationToken);

      return results;
    } catch (error) {
      console.error(`Error listing files for provider ${provider}:`, error);
      return [];
    }
  }

  async deleteFile(
    provider: string,
    filePath: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const config = EXTERNAL_R2_CONFIGS[provider];
      if (!config) {
        return { success: false, error: `Provider ${provider} not found` };
      }

      const client = r2Manager.getClient(provider);
      if (!client) {
        return {
          success: false,
          error: `Client for provider ${provider} not available`,
        };
      }

      await client.send(
        new DeleteObjectCommand({
          Bucket: config.bucketName,
          Key: filePath,
        }),
      );
      return { success: true };
    } catch (error) {
      console.error(`Error deleting file ${filePath} from provider ${provider}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Server-side copy within the same R2 bucket (no download/re-upload).
   * CopySource must be URL-encoded for keys with special characters.
   */
  async copyFile(
    provider: string,
    sourceKey: string,
    destKey: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const config = EXTERNAL_R2_CONFIGS[provider];
      if (!config) {
        return { success: false, error: `Provider ${provider} not found` };
      }

      const client = r2Manager.getClient(provider);
      if (!client) {
        return {
          success: false,
          error: `Client for provider ${provider} not available`,
        };
      }

      const encodedSource = `${config.bucketName}/${sourceKey
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`;

      await client.send(
        new CopyObjectCommand({
          Bucket: config.bucketName,
          CopySource: encodedSource,
          Key: destKey,
        }),
      );

      return { success: true };
    } catch (error) {
      console.error(
        `Error copying ${sourceKey} → ${destKey} on ${provider}:`,
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Copy failed",
      };
    }
  }

  /** Copy then delete source (atomic-enough promote for temp → permanent). */
  async moveFile(
    provider: string,
    sourceKey: string,
    destKey: string,
  ): Promise<{ success: boolean; error?: string }> {
    const copied = await this.copyFile(provider, sourceKey, destKey);
    if (!copied.success) return copied;

    const deleted = await this.deleteFile(provider, sourceKey);
    if (!deleted.success) {
      console.warn(
        `Copied ${sourceKey} → ${destKey} but failed to delete source: ${deleted.error}`,
      );
      // Still treat as success — permanent file exists
    }
    return { success: true };
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    contentType: string,
    config: MediaUploadConfig,
  ): Promise<UploadResult> {
    try {
      const fullPath = `${config.folder}/${fileName}`;
      const client = r2Manager.getClient(config.provider);
      if (!client) {
        return {
          success: false,
          error: `R2 client not found for provider: ${config.provider}`,
        };
      }

      const r2Config = EXTERNAL_R2_CONFIGS[config.provider];
      if (!r2Config) {
        return {
          success: false,
          error: `R2 configuration not found: ${config.provider}`,
        };
      }

      await client.send(
        new PutObjectCommand({
          Bucket: r2Config.bucketName,
          Key: fullPath,
          Body: fileBuffer,
          ContentType: contentType,
        }),
      );

      return {
        success: true,
        url: `/api/${fullPath}`,
        path: fullPath,
        provider: config.provider,
      };
    } catch (error) {
      console.error("Error uploading file:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      };
    }
  }

  async deleteAudio(filename: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await this.deleteFile("primary", `audio/${filename}`);
    } catch (error) {
      console.error(`Error deleting audio file ${filename}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const multiR2Storage = new MultiR2StorageService();

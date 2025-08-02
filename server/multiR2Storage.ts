import { r2Manager, EXTERNAL_R2_CONFIGS } from "./r2Config";
import { randomUUID } from "crypto";

export interface MediaUploadConfig {
  provider: "replit" | "primary" | "secondary";
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
  url: string;
  lastModified: string;
  size: number;
}

export class MultiR2StorageService {
  
  // Get upload URL for different providers
  async getUploadUrl(config: MediaUploadConfig): Promise<UploadResult> {
    const fileId = randomUUID();
    const fileName = `${config.folder}/${fileId}`;

    try {
      if (config.provider === "replit") {
        // Use existing Replit object storage
        return await this.getReplitUploadUrl(fileName);
      } else {
        // Use external R2
        return await this.getExternalR2UploadUrl(config.provider, fileName);
      }
    } catch (error) {
      console.error("Error getting upload URL:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  // Get Replit object storage upload URL (existing implementation)
  private async getReplitUploadUrl(fileName: string): Promise<UploadResult> {
    try {
      // Use existing ObjectStorageService for Replit
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      
      return {
        success: true,
        url: uploadURL,
        path: `/objects/uploads/${fileName}`,
        provider: "replit"
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Replit upload URL generation failed"
      };
    }
  }

  // Get external R2 upload URL
  private async getExternalR2UploadUrl(provider: string, fileName: string): Promise<UploadResult> {
    try {
      const uploadUrl = await r2Manager.generateUploadUrl(provider, fileName, 3600);
      
      if (!uploadUrl) {
        return {
          success: false,
          error: `Failed to generate upload URL for provider: ${provider}`
        };
      }

      const config = EXTERNAL_R2_CONFIGS[provider];
      const publicUrl = `${config.endpoint}/${config.bucketName}/${fileName}`;

      return {
        success: true,
        url: uploadUrl,
        path: publicUrl,
        provider: provider
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "External R2 upload URL generation failed"
      };
    }
  }

  // Test all R2 connections
  async testAllConnections(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    // Test Replit connection (always available)
    results.replit = true;
    
    // Test external R2 connections
    const externalConfigs = r2Manager.getAvailableConfigs();
    for (const configName of externalConfigs) {
      results[configName] = await r2Manager.testConnection(configName);
    }

    return results;
  }

  // Get available storage providers
  getAvailableProviders(): Array<{
    id: string;
    name: string;
    status: "available" | "configured" | "missing";
  }> {
    const providers = [
      {
        id: "replit",
        name: "Replit Object Storage",
        status: "available" as const
      }
    ];

    // Add external providers
    Object.keys(EXTERNAL_R2_CONFIGS).forEach(configName => {
      const config = EXTERNAL_R2_CONFIGS[configName];
      const isConfigured = !!(config.accessKeyId && config.secretAccessKey && config.bucketName);
      
      providers.push({
        id: configName,
        name: `Cloudflare R2 (${configName})`,
        status: isConfigured ? "configured" : "missing"
      });
    });

    return providers;
  }

  // Get download URL for external R2 files using presigned URLs
  async getDownloadUrl(provider: string, fileName: string): Promise<string | null> {
    try {
      if (provider === "replit") {
        return null; // Use Replit object storage instead
      }

      const config = EXTERNAL_R2_CONFIGS[provider];
      if (!config || !config.bucketName) {
        return null;
      }

      // Generate presigned URL for download
      const downloadUrl = await r2Manager.generateDownloadUrl(provider, fileName, 3600);
      console.log(`Generated R2 presigned URL: ${downloadUrl}`);
      return downloadUrl;
    } catch (error) {
      console.error(`Error getting download URL for ${provider}:`, error);
      return null;
    }
  }

  // Get storage configuration for frontend
  getStorageConfig(provider: string) {
    if (provider === "replit") {
      return {
        provider: "replit",
        name: "Replit Object Storage",
        maxSizeBytes: 50 * 1024 * 1024, // 50MB
        allowedTypes: ["image/*", "video/*"]
      };
    }

    const config = EXTERNAL_R2_CONFIGS[provider];
    if (config) {
      return {
        provider: provider,
        name: `Cloudflare R2 (${provider})`,
        maxSizeBytes: 100 * 1024 * 1024, // 100MB for external R2
        allowedTypes: ["image/*", "video/*", "application/pdf", "text/*"]
      };
    }

    return null;
  }

  // List files in a folder for a specific provider
  async listFiles(provider: string, prefix: string = ""): Promise<FileInfo[]> {
    try {
      if (provider === "replit") {
        // For Replit object storage, we can't easily list files without implementing listing
        // Return empty array for now
        return [];
      }

      const config = EXTERNAL_R2_CONFIGS[provider];
      if (!config) {
        throw new Error(`Provider ${provider} not found`);
      }

      const client = r2Manager.getClient(provider);
      if (!client) {
        throw new Error(`Client for provider ${provider} not available`);
      }

      // Use listObjectsV2 to get files from R2
      const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
      const command = new ListObjectsV2Command({
        Bucket: config.bucketName,
        Prefix: prefix,
        MaxKeys: 100
      });

      const response = await client.send(command);
      
      if (!response.Contents) {
        return [];
      }

      return response.Contents
        .filter(obj => obj.Key && obj.Key !== prefix) // Exclude folder itself
        .map(obj => ({
          name: obj.Key!.split('/').pop() || obj.Key!,
          url: `${config.endpoint}/${config.bucketName}/${obj.Key}`,
          lastModified: obj.LastModified?.toISOString() || new Date().toISOString(),
          size: obj.Size || 0
        }));

    } catch (error) {
      console.error(`Error listing files for provider ${provider}:`, error);
      return [];
    }
  }

  // Delete a file from a specific provider
  async deleteFile(provider: string, filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (provider === "replit") {
        // For Replit object storage, return success for now
        return { success: true };
      }

      const config = EXTERNAL_R2_CONFIGS[provider];
      if (!config) {
        return { success: false, error: `Provider ${provider} not found` };
      }

      const client = r2Manager.getClient(provider);
      if (!client) {
        return { success: false, error: `Client for provider ${provider} not available` };
      }

      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      const command = new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: filePath
      });

      await client.send(command);
      return { success: true };

    } catch (error) {
      console.error(`Error deleting file ${filePath} from provider ${provider}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }
}

export const multiR2Storage = new MultiR2StorageService();
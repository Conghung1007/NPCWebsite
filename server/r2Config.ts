import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

// Interface for R2 configuration
export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
  region?: string;
}

// Default Replit R2 configuration (using existing object storage)
export const REPLIT_R2_CONFIG: R2Config = {
  accountId: "replit",
  accessKeyId: process.env.R2_ACCESS_KEY_ID || "replit-default",
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "replit-default",
  bucketName: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "replit-default-bucket",
  endpoint: "https://storage.googleapis.com", // Replit uses GCS backend
  region: "auto"
};

// External R2 configurations
export const EXTERNAL_R2_CONFIGS: Record<string, R2Config> = {
  // Primary external R2 account
  primary: {
    accountId: process.env.R2_PRIMARY_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_PRIMARY_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_PRIMARY_SECRET_ACCESS_KEY || "",
    bucketName: process.env.R2_PRIMARY_BUCKET_NAME || "",
    endpoint: process.env.R2_PRIMARY_ENDPOINT || "https://your-account-id.r2.cloudflarestorage.com",
    region: "auto"
  },
  
  // Secondary external R2 account
  secondary: {
    accountId: process.env.R2_SECONDARY_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_SECONDARY_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECONDARY_SECRET_ACCESS_KEY || "",
    bucketName: process.env.R2_SECONDARY_BUCKET_NAME || "",
    endpoint: process.env.R2_SECONDARY_ENDPOINT || "https://your-secondary-account-id.r2.cloudflarestorage.com",
    region: "auto"
  }
};

// R2 Client manager
export class R2ClientManager {
  private clients: Map<string, S3Client> = new Map();

  constructor() {
    this.initializeClients();
  }

  private initializeClients() {
    // Initialize external R2 clients
    Object.entries(EXTERNAL_R2_CONFIGS).forEach(([configName, config]) => {
      if (config.accessKeyId && config.secretAccessKey && config.bucketName) {
        const client = new S3Client({
          region: config.region || "auto",
          endpoint: config.endpoint,
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
          forcePathStyle: true,
        });
        
        this.clients.set(configName, client);
        console.log(`Initialized R2 client for: ${configName}`);
      } else {
        console.warn(`Incomplete R2 configuration for: ${configName}`);
      }
    });
  }

  // Get client by configuration name
  getClient(configName: string): S3Client | null {
    return this.clients.get(configName) || null;
  }

  // Get available configurations
  getAvailableConfigs(): string[] {
    return Array.from(this.clients.keys());
  }

  // Generate presigned URL for upload
  async generateUploadUrl(
    configName: string,
    key: string,
    expiresIn: number = 3600
  ): Promise<string | null> {
    const client = this.getClient(configName);
    if (!client) {
      console.error(`R2 client not found for config: ${configName}`);
      return null;
    }

    const config = EXTERNAL_R2_CONFIGS[configName];
    if (!config) {
      console.error(`R2 configuration not found: ${configName}`);
      return null;
    }

    try {
      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error(`Error generating upload URL for ${configName}:`, error);
      return null;
    }
  }

  // Generate presigned URL for download
  async generateDownloadUrl(
    configName: string,
    key: string,
    expiresIn: number = 3600
  ): Promise<string | null> {
    const client = this.getClient(configName);
    if (!client) {
      console.error(`R2 client not found for config: ${configName}`);
      return null;
    }

    const config = EXTERNAL_R2_CONFIGS[configName];
    if (!config) {
      console.error(`R2 configuration not found: ${configName}`);
      return null;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error(`Error generating download URL for ${configName}:`, error);
      return null;
    }
  }

  // Test connection to R2
  async testConnection(configName: string): Promise<boolean> {
    const client = this.getClient(configName);
    if (!client) {
      return false;
    }

    try {
      // Try to generate a test presigned URL
      const testKey = `test-connection-${Date.now()}.txt`;
      const url = await this.generateUploadUrl(configName, testKey, 60);
      return !!url;
    } catch (error) {
      console.error(`Connection test failed for ${configName}:`, error);
      return false;
    }
  }
}

// Global instance
export const r2Manager = new R2ClientManager();
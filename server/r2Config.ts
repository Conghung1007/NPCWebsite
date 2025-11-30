import { S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { 
  PutObjectCommand, 
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand
} from "@aws-sdk/client-s3";

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
    expiresIn: number = 3600,
    contentType?: string
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
        ContentType: contentType || 'application/octet-stream'
      });

      const signedUrl = await getSignedUrl(client, command, { 
        expiresIn
      });
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

  // Initialize multipart upload
  async initMultipartUpload(
    configName: string,
    key: string,
    contentType: string
  ): Promise<{ uploadId: string } | null> {
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
      const command = new CreateMultipartUploadCommand({
        Bucket: config.bucketName,
        Key: key,
        ContentType: contentType
      });

      const response = await client.send(command);
      if (response.UploadId) {
        return { uploadId: response.UploadId };
      }
      return null;
    } catch (error) {
      console.error(`Error initializing multipart upload for ${configName}:`, error);
      return null;
    }
  }

  // Generate presigned URL for uploading a part
  async generatePartUploadUrl(
    configName: string,
    key: string,
    uploadId: string,
    partNumber: number,
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
      const command = new UploadPartCommand({
        Bucket: config.bucketName,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber
      });

      const signedUrl = await getSignedUrl(client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error(`Error generating part upload URL for ${configName}:`, error);
      return null;
    }
  }

  // Complete multipart upload
  async completeMultipartUpload(
    configName: string,
    key: string,
    uploadId: string,
    parts: Array<{ PartNumber: number; ETag: string }>
  ): Promise<boolean> {
    const client = this.getClient(configName);
    if (!client) {
      console.error(`R2 client not found for config: ${configName}`);
      return false;
    }

    const config = EXTERNAL_R2_CONFIGS[configName];
    if (!config) {
      console.error(`R2 configuration not found: ${configName}`);
      return false;
    }

    try {
      const command = new CompleteMultipartUploadCommand({
        Bucket: config.bucketName,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber)
        }
      });

      await client.send(command);
      return true;
    } catch (error) {
      console.error(`Error completing multipart upload for ${configName}:`, error);
      return false;
    }
  }

  // Abort multipart upload
  async abortMultipartUpload(
    configName: string,
    key: string,
    uploadId: string
  ): Promise<boolean> {
    const client = this.getClient(configName);
    if (!client) {
      return false;
    }

    const config = EXTERNAL_R2_CONFIGS[configName];
    if (!config) {
      return false;
    }

    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: config.bucketName,
        Key: key,
        UploadId: uploadId
      });

      await client.send(command);
      return true;
    } catch (error) {
      console.error(`Error aborting multipart upload for ${configName}:`, error);
      return false;
    }
  }

  // Get object metadata (size, content-type, etc.)
  async getObjectMetadata(
    configName: string,
    key: string
  ): Promise<{ size: number; contentType: string } | null> {
    const client = this.getClient(configName);
    if (!client) {
      return null;
    }

    const config = EXTERNAL_R2_CONFIGS[configName];
    if (!config) {
      return null;
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: key
      });

      const response = await client.send(command);
      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream'
      };
    } catch (error) {
      console.error(`Error getting object metadata for ${configName}:`, error);
      return null;
    }
  }

  // Generate presigned URL with Range header support for chunked download
  async generateRangeDownloadUrl(
    configName: string,
    key: string,
    expiresIn: number = 3600
  ): Promise<string | null> {
    return this.generateDownloadUrl(configName, key, expiresIn);
  }
}

// Global instance
export const r2Manager = new R2ClientManager();
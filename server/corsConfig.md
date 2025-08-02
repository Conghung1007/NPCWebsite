# CORS Configuration for Cloudflare R2

The upload failure is likely due to CORS (Cross-Origin Resource Sharing) configuration on the Cloudflare R2 bucket.

## Required CORS Settings for R2 Bucket:

```json
[
  {
    "AllowedOrigins": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

## How to Configure CORS on Cloudflare R2:

1. Go to Cloudflare Dashboard → R2 Object Storage
2. Select your bucket (npcompany)
3. Go to Settings → CORS policy
4. Add the above CORS configuration
5. Save the settings

## Alternative: Use Replit Object Storage

If CORS cannot be configured on external R2, we can fall back to using Replit's built-in object storage which has CORS enabled by default.
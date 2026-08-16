# CORS Configuration for Cloudflare R2



## Portal hosts (Phase 4)



If you restrict origins (instead of `*`), allow at least:



- `https://npgroup.vn`

- `https://www.npgroup.vn`

- `https://tnjs.npgroup.vn`

- `https://duhoc.npgroup.vn`

- `https://daotao.npgroup.vn`

- `https://npc-website.onrender.com` (optional, until DNS cutover)



Uploads go through the app API (not browser→R2 directly) in most flows; proxy-image still needs the bucket readable.



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



import sharp from "sharp";

export type DetectedImageMime =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/gif";

const AVATAR_MAX_EDGE = 512;
const AVATAR_WEBP_QUALITY = 82;

/** Detect image type from magic bytes (ignores claimed Content-Type). */
export function detectImageMime(buf: Buffer): DetectedImageMime | null {
  if (buf.length < 12) return null;

  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return "image/gif";
  }
  // WEBP (RIFF....WEBP)
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export type ProcessedAvatar = {
  buffer: Buffer;
  contentType: "image/webp";
  ext: "webp";
};

/**
 * Validate magic bytes, auto-orient, center-crop to square, resize ≤512px, encode WebP.
 * Animated GIF/WebP become a single frame (appropriate for avatars).
 */
export async function processAvatarImage(
  input: Buffer,
): Promise<ProcessedAvatar> {
  const detected = detectImageMime(input);
  if (!detected) {
    throw new Error("INVALID_IMAGE");
  }

  const buffer = await sharp(input, { animated: false, failOn: "truncated" })
    .rotate()
    .resize(AVATAR_MAX_EDGE, AVATAR_MAX_EDGE, {
      fit: "cover",
      position: "centre",
      withoutEnlargement: true,
    })
    .webp({ quality: AVATAR_WEBP_QUALITY })
    .toBuffer();

  return { buffer, contentType: "image/webp", ext: "webp" };
}

/** Parse `/api/proxy-image/{provider}/avatars/...` into R2 delete args. */
export function parseStoredAvatarRef(
  avatarUrl: string | null | undefined,
): { provider: string; key: string } | null {
  if (!avatarUrl) return null;
  const match = avatarUrl.match(
    /^\/api\/proxy-image\/([^/]+)\/(avatars\/.+)$/,
  );
  if (!match) return null;
  return { provider: match[1], key: match[2] };
}

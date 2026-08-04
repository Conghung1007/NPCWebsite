/**
 * Upload an image to R2 via the article/media multipart endpoint.
 * Returns an app-relative URL like `/api/article-images/...`.
 */
export async function uploadImageToR2(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file, file.name || `paste-${Date.now()}.png`);

  const res = await fetch("/api/upload/image", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let message = "Failed to upload image";
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const data = await res.json();
  const imageUrl = data.imageUrl as string | undefined;
  if (!imageUrl) {
    throw new Error("Upload succeeded but no imageUrl returned");
  }
  return imageUrl;
}

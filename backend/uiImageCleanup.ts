import { multiR2Storage } from "./multiR2Storage";
import { storage } from "./storage";
import { r2FileNameFromUiImageUrl } from "@shared/pageSections";

export type UiImagePurgeResult = {
  dbRemoved: number;
  r2Removed: number;
  r2Skipped: number;
  slots: string[];
};

/** Remove ui_images rows + R2 objects for the given CMS slots (per portal). */
export async function purgeUiImageSlots(
  portal: string,
  imageTypes: string[],
): Promise<UiImagePurgeResult> {
  const unique = [...new Set(imageTypes.map((t) => t.trim()).filter(Boolean))];
  let dbRemoved = 0;
  let r2Removed = 0;
  let r2Skipped = 0;
  const purgedSlots: string[] = [];

  for (const imageType of unique) {
    const row = await storage.getUiImageByType(imageType, portal);
    if (!row) continue;

    purgedSlots.push(imageType);
    await storage.deleteUiImage(row.id);
    dbRemoved++;

    const fileName = r2FileNameFromUiImageUrl(row.imageUrl);
    if (!fileName) {
      r2Skipped++;
      continue;
    }

    try {
      const result = await multiR2Storage.deleteFile(
        "primary",
        `ui-images/${fileName}`,
      );
      if (result.success) r2Removed++;
      else r2Skipped++;
    } catch {
      r2Skipped++;
    }
  }

  return { dbRemoved, r2Removed, r2Skipped, slots: purgedSlots };
}

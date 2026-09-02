/**
 * TNJS-style CMS: content is edited in Cpanel only, not inline on public pages.
 * Set VITE_INLINE_CONTENT_EDIT=true to re-enable legacy inline editing (dev/debug).
 */
export function useContentEditMode(): boolean {
  return import.meta.env.VITE_INLINE_CONTENT_EDIT === "true";
}

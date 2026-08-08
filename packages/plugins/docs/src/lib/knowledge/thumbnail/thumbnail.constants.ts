/**
 * Thumbnail generation constants (07 §4.4).
 *
 * Deliberately small: a thumbnail is a grid tile, not a preview. Anything larger costs
 * storage and bandwidth on every list render for no visible gain.
 */

/** Longest side of a generated thumbnail, in pixels. */
export const DOCS_THUMBNAIL_MAX_PX = 320;

/** WebP quality of a generated thumbnail (visually lossless at this size). */
export const DOCS_THUMBNAIL_QUALITY = 72;

/** Suffix appended to the source storage key — `<key-without-ext>-thumb.webp`. */
export const DOCS_THUMBNAIL_SUFFIX = '-thumb.webp';

/** Raster image types that produce a thumbnail directly through `sharp`. */
export const THUMBNAILABLE_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/** The only non-image type with a thumbnail: page 1 of a PDF, rasterized first. */
export const THUMBNAILABLE_PDF_MIME_TYPE = 'application/pdf';

/**
 * Whether a stored MIME can produce a thumbnail at all.
 *
 * Pure and exported because it is asked in **two** places that must agree: the pipeline
 * (which skips enqueuing the job entirely for a docx/csv/txt — no queue traffic for work
 * that would immediately no-op) and the thumbnail service itself (the authoritative skip,
 * since a job can also arrive from a reprocess or a recovery sweep).
 *
 * @param mimeType The sniffed canonical MIME stored on the document.
 */
export function isThumbnailableMime(mimeType?: string | null): boolean {
	if (!mimeType) {
		return false;
	}
	return mimeType === THUMBNAILABLE_PDF_MIME_TYPE || THUMBNAILABLE_IMAGE_MIME_TYPES.includes(mimeType);
}

/**
 * Derives the thumbnail storage key from the source key: same directory, same basename,
 * `-thumb.webp` instead of the original extension. Keeping it adjacent to the source means
 * the existing key-shape guard, retention and cleanup all cover it for free.
 *
 * @param storageKey The document's stored file key.
 */
export function thumbnailKeyFor(storageKey: string): string {
	return `${storageKey.replace(/\.[A-Za-z0-9]+$/, '')}${DOCS_THUMBNAIL_SUFFIX}`;
}

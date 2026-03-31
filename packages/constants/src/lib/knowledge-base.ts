/**
 * Knowledge-base related constants.
 */

/**
 * Maximum allowed size in bytes for a binary article description upload.
 * 10 MB — chosen as a safe upper bound for rich-text editor binary payloads
 * (ProseMirror / TipTap binary documents are typically well below 1 MB).
 */
export const HELP_CENTER_ARTICLE_MAX_BINARY_BYTES = 10 * 1024 * 1024;

/**
 * Sync tag constants used to categorize synchronization sources.
 */
export const SyncTags = {
	GITHUB: 'GitHub',
	GAUZY: 'Gauzy'
} as const;

/**
 * Type definition for valid sync tag values.
 */
export type SyncTag = (typeof SyncTags)[keyof typeof SyncTags];

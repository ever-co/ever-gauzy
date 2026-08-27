/**
 * Pure helpers for resolving the avatars that ship with the seed.
 *
 * Seeded users, employees and candidates carry `imageUrl: 'assets/images/avatars/<file>'`. That path
 * only resolves inside the Angular Gauzy app, which ships `<base href="/">`; every other client
 * resolves it against whatever route it is on and 404s, because the files live in
 * `apps/gauzy/src/assets/images/avatars/` and are served by no API and no CDN.
 *
 * The seed therefore copies each avatar into the API's public assets and stores a real `ImageAsset`,
 * the same way `createDefaultIssueTypes` already handles task icons. This module holds the decision
 * logic, kept free of TypeORM/config imports so it stays trivially testable.
 */

/** Directory under `apps/api/src/assets/seed` (and under the API public path) holding the avatars. */
export const SEED_AVATARS_DIR = 'avatars';

/** The prefix the seed constants use to reference an avatar that ships with the repository. */
const SEED_AVATAR_PREFIX = 'assets/images/avatars/';

/** Matches a URI scheme such as `https:` or `data:` at the start of a value. */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Returns the bare filename of a seeded avatar reference, or `undefined` when the value is not one.
 *
 * Anything already resolvable on its own — an absolute URL, a protocol-relative URL, or the
 * `dummyimage.com` placeholder a user gets when no avatar was supplied — is left alone, because it is
 * a real avatar rather than a seed asset reference.
 *
 * The result is passed to a file copy, so a value that could escape the flat seed directory
 * (traversal, or any nested path) is refused.
 */
export function getSeedAvatarFileName(imageUrl?: string | null): string | undefined {
	if (!imageUrl) return undefined;

	const value = imageUrl.trim();
	if (!value) return undefined;

	// Already resolvable without a base: not a seed asset reference.
	if (HAS_SCHEME.test(value) || value.startsWith('//')) return undefined;

	const relative = value.replace(/^\/+/, '');
	if (!relative.startsWith(SEED_AVATAR_PREFIX)) return undefined;

	const fileName = relative.slice(SEED_AVATAR_PREFIX.length);

	// The seed directory is flat: reject nested paths and anything that could traverse out of it.
	if (!fileName || fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
		return undefined;
	}

	return fileName;
}

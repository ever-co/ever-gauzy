import { getSeedAvatarFileName, shouldSeedAvatar } from './user-avatar';

/**
 * Seeded users and employees carry `imageUrl: 'assets/images/avatars/<file>'` — a path that only
 * resolves inside the Angular Gauzy app, which ships `<base href="/">`. Every other client (Ever Teams
 * on Next.js, mobile, …) resolved it against whatever route it was on and 404'd, because those files
 * live only in `apps/gauzy/src/assets/images/avatars/` and are served by no API or CDN.
 *
 * The seed now copies the file into the API's public assets and creates a real ImageAsset, exactly as
 * `createDefaultIssueTypes` already does for task icons. This helper decides which seed values are
 * such an avatar reference — and, because its result is fed to a file copy, refuses anything that
 * could escape the flat seed directory.
 */
describe('getSeedAvatarFileName', () => {
	it('returns the bare filename for a seeded avatar path', () => {
		expect(getSeedAvatarFileName('assets/images/avatars/alish.jpg')).toBe('alish.jpg');
	});

	it('tolerates a leading slash', () => {
		expect(getSeedAvatarFileName('/assets/images/avatars/avatar-default.svg')).toBe('avatar-default.svg');
	});

	it('trims surrounding whitespace', () => {
		expect(getSeedAvatarFileName('  assets/images/avatars/ruslan.jpg  ')).toBe('ruslan.jpg');
	});

	it('ignores an absolute URL, which is a real uploaded avatar', () => {
		expect(getSeedAvatarFileName('https://cdn.ever.co/avatars/alish.jpg')).toBeUndefined();
	});

	it('ignores a dummy image URL', () => {
		expect(getSeedAvatarFileName('https://dummyimage.com/330x300/000/fff&text=A')).toBeUndefined();
	});

	it('ignores an unrelated relative path', () => {
		expect(getSeedAvatarFileName('assets/images/logos/ever.png')).toBeUndefined();
	});

	it('returns undefined for empty, whitespace-only, null and undefined', () => {
		expect(getSeedAvatarFileName('')).toBeUndefined();
		expect(getSeedAvatarFileName('   ')).toBeUndefined();
		expect(getSeedAvatarFileName(null)).toBeUndefined();
		expect(getSeedAvatarFileName(undefined)).toBeUndefined();
	});

	// The value is passed to a file copy, so it must never be able to leave the flat seed directory.
	it('refuses path traversal', () => {
		expect(getSeedAvatarFileName('assets/images/avatars/../../../../etc/passwd')).toBeUndefined();
	});

	it('refuses a nested path inside the seed directory', () => {
		expect(getSeedAvatarFileName('assets/images/avatars/nested/alish.jpg')).toBeUndefined();
	});

	it('refuses a backslash-separated nested path', () => {
		expect(getSeedAvatarFileName('assets/images/avatars/nested\\alish.jpg')).toBeUndefined();
	});
});

/**
 * `generateDefaultUser` reuses an existing row when one is found, so a re-seed against a persistent
 * database must not replace an avatar the user uploaded themselves (and must not orphan its asset).
 * This mirrors how the same function already preserves an existing password hash.
 *
 * A user still carrying the old seeded `imageUrl` has no ImageAsset at all, so they are still
 * backfilled — that is the case this change exists to repair.
 */
describe('shouldSeedAvatar', () => {
	it('seeds for a brand new user', () => {
		expect(shouldSeedAvatar(undefined)).toBe(true);
		expect(shouldSeedAvatar(null)).toBe(true);
	});

	it('does not replace an avatar the user already has', () => {
		expect(shouldSeedAvatar({ imageId: '00000000-0000-4000-8000-000000000001' })).toBe(false);
	});

	it('does not replace an avatar known only through the loaded relation', () => {
		expect(shouldSeedAvatar({ image: { id: '00000000-0000-4000-8000-000000000002' } })).toBe(false);
	});

	// Not every real avatar has an ImageAsset behind it: a social-login user typically carries only
	// the provider's URL, and a user created without one carries the dummy placeholder. Neither is a
	// legacy seed path, so neither may be overwritten.
	it('does not replace a real avatar URL that has no ImageAsset behind it', () => {
		expect(shouldSeedAvatar({ imageUrl: 'https://cdn.example.com/avatar.jpg' })).toBe(false);
	});

	it('does not replace the dummy placeholder a user was given at creation', () => {
		expect(shouldSeedAvatar({ imageUrl: 'https://dummyimage.com/330x300/000/fff&text=A' })).toBe(false);
	});

	it('backfills an existing user that still carries the legacy seed path', () => {
		expect(shouldSeedAvatar({ imageUrl: 'assets/images/avatars/alish.jpg' })).toBe(true);
		expect(shouldSeedAvatar({ imageUrl: '/assets/images/avatars/avatar-default.svg' })).toBe(true);
	});

	it('backfills an existing user with no avatar at all', () => {
		expect(shouldSeedAvatar({ imageId: null, image: null })).toBe(true);
		expect(shouldSeedAvatar({ imageUrl: '' })).toBe(true);
		expect(shouldSeedAvatar({})).toBe(true);
	});
});

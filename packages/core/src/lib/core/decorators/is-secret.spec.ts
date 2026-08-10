// `IsSecret` stores its flag via `Reflect.defineMetadata`, which the runtime only gains once
// reflect-metadata is loaded. The application does that at bootstrap; an isolated spec must do it
// itself, before importing the module under test.
import 'reflect-metadata';
import { IsSecret, WrapSecrets, maskSecret } from './is-secret';

/**
 * Returns true when any run of `length` consecutive characters from the middle of `secret`
 * survives into `masked`. The old masking starred only the first and last N characters, so a
 * plain `masked !== secret` assertion passed while half the credential was still readable.
 */
function leaksSubstringOf(secret: string, masked: string, length = 4): boolean {
	for (let i = 0; i + length <= secret.length; i++) {
		if (masked.includes(secret.slice(i, i + length))) {
			return true;
		}
	}
	return false;
}

describe('maskSecret', () => {
	it('leaves no contiguous run of the original visible beyond the trailing hint', () => {
		// A realistic GitHub token — the length at which the previous implementation returned
		// roughly twenty consecutive cleartext characters (GHSA-3rqg-gpm9-gx84).
		const secret = 'gho_16C7e42F292c6912E7710c838347Ae178B4a';
		const masked = maskSecret(secret);

		expect(masked).not.toBe(secret);
		expect(masked.slice(0, -4)).toBe('*'.repeat(secret.length - 4));
		expect(leaksSubstringOf(secret.slice(0, -4), masked)).toBe(false);
	});

	it('keeps only the last four characters as a hint', () => {
		expect(maskSecret('abcdefghijklmnop')).toBe('************mnop');
	});

	it('fully masks values at or below the hint length', () => {
		expect(maskSecret('a')).toBe('*');
		expect(maskSecret('abcd')).toBe('****');
	});

	it('masks the real tail rather than an earlier identical run', () => {
		// The previous implementation used non-global String.replace, so a suffix that also occurred
		// earlier in the value was masked instead of the actual tail, leaving the tail readable.
		const secret = 'SECRETmiddleSECRET';
		const masked = maskSecret(secret);
		expect(masked).toBe('**************CRET');
	});

	it('handles empty and nullish values without throwing', () => {
		expect(maskSecret('')).toBe('');
		expect(maskSecret(null)).toBe('');
		expect(maskSecret(undefined)).toBe('');
	});

	it('honours a custom masking character', () => {
		expect(maskSecret('abcdefgh', '•')).toBe('••••efgh');
	});
});

describe('WrapSecrets', () => {
	class Credentials {
		accessToken?: string;
		refreshToken?: string;
		region?: string;
	}
	IsSecret()(Credentials.prototype, 'accessToken');
	IsSecret()(Credentials.prototype, 'refreshToken');

	it('masks every property marked with @IsSecret', () => {
		const accessToken = 'gho_16C7e42F292c6912E7710c838347Ae178B4a';
		const refreshToken = 'r1.0000bbbbCCCCddddEEEEffff1111GGGG';

		const wrapped = WrapSecrets({ accessToken, refreshToken, region: 'us2' }, new Credentials());

		expect(wrapped.accessToken).not.toBe(accessToken);
		expect(wrapped.refreshToken).not.toBe(refreshToken);
		expect(leaksSubstringOf(accessToken.slice(0, -4), wrapped.accessToken)).toBe(false);
		expect(leaksSubstringOf(refreshToken.slice(0, -4), wrapped.refreshToken)).toBe(false);
	});

	it('leaves properties without @IsSecret untouched', () => {
		const wrapped = WrapSecrets({ accessToken: 'abcdefghijkl', region: 'us2' }, new Credentials());
		expect(wrapped.region).toBe('us2');
	});

	it('ignores empty values', () => {
		const wrapped = WrapSecrets({ accessToken: '', refreshToken: null }, new Credentials());
		expect(wrapped.accessToken).toBe('');
		expect(wrapped.refreshToken).toBeNull();
	});
});

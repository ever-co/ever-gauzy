import { emailsFromOidcClaims, flagProviderConfirmedEmails } from './social-auth-emails';

/**
 * Sign-in matches existing accounts only through addresses flagged `verified`
 * (AuthService.validateOAuthLoginEmail), so these helpers may set the flag only on the provider's own guarantee.
 */
describe('social-auth-emails', () => {
	describe('flagProviderConfirmedEmails', () => {
		it('flags every address the provider returned as verified', () => {
			expect(flagProviderConfirmedEmails([{ value: 'ada@example.com' }, { value: 'ada@work.example' }])).toEqual([
				{ value: 'ada@example.com', verified: true },
				{ value: 'ada@work.example', verified: true }
			]);
		});

		it('never flags a missing or blank value as verified', () => {
			expect(
				flagProviderConfirmedEmails([{ value: '' }, { value: '   ' }, { value: undefined }, {}, null])
			).toEqual([
				{ value: '', verified: false },
				{ value: '   ', verified: false },
				{ value: undefined, verified: false },
				{ value: undefined, verified: false },
				{ value: undefined, verified: false }
			]);
		});

		it('never flags a value that is not a string as verified', () => {
			expect(flagProviderConfirmedEmails([{ value: 42 as unknown as string }])).toEqual([
				{ value: 42, verified: false }
			]);
		});

		it('returns an empty list when the provider sent no address', () => {
			expect(flagProviderConfirmedEmails(undefined)).toEqual([]);
			expect(flagProviderConfirmedEmails(null)).toEqual([]);
			expect(flagProviderConfirmedEmails([])).toEqual([]);
		});
	});

	describe('emailsFromOidcClaims', () => {
		it('flags the address verified when email_verified is true', () => {
			expect(emailsFromOidcClaims({ email: 'ada@example.com', email_verified: true })).toEqual([
				{ value: 'ada@example.com', verified: true }
			]);
		});

		it('keeps an unverified address, flagged unverified', () => {
			expect(emailsFromOidcClaims({ email: 'ada@example.com', email_verified: false })).toEqual([
				{ value: 'ada@example.com', verified: false }
			]);
		});

		it('reads a missing email_verified, or any value but the boolean true, as unverified', () => {
			for (const emailVerified of [undefined, null, 'true', 1, {}]) {
				expect(emailsFromOidcClaims({ email: 'ada@example.com', email_verified: emailVerified })).toEqual([
					{ value: 'ada@example.com', verified: false }
				]);
			}
		});

		it('returns no address when the claims carry none, even with email_verified true', () => {
			for (const email of [undefined, null, '', '  ', 42]) {
				expect(emailsFromOidcClaims({ email, email_verified: true })).toEqual([]);
			}
			expect(emailsFromOidcClaims(undefined)).toEqual([]);
			expect(emailsFromOidcClaims(null)).toEqual([]);
		});
	});
});

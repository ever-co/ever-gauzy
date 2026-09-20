import { sign, verify } from 'jsonwebtoken';
import { isKnownDefaultSecret } from '@gauzy/contracts';
import { DESKTOP_SECRET_ENV, desktopSecretsToEnv, ensureDesktopSecrets, redactSecretsForLog } from './desktop-secrets';

/**
 * Regression suite for GHSA-39j7-x845-4w3c, desktop side.
 *
 * The desktop apps run the API on 0.0.0.0. Their builds defaulted DESKTOP_JWT_SECRET to `secretKey`
 * and DESKTOP_JWT_REFRESH_TOKEN_SECRET to `refreshTokenSecretKey`, the setup screen stored those as
 * the install's secrets, and the verification and session secrets were never passed to the API at
 * all. Anyone on the LAN could forge a token for a default install.
 *
 * Electron cannot run here, so the decision logic is a pure function and is tested directly.
 */
describe('ensureDesktopSecrets', () => {
	/** What a pre-fix install stored in `configs.secret`. */
	const PRE_FIX_STORED = { jwt: 'secretKey', refresh_token: 'refreshTokenSecretKey' };

	/** An attacker's forged token for a known user id, signed with the published desktop default. */
	const forged = sign({ id: 'victim-user-id' }, 'secretKey');
	const acceptsForgery = (secret: string) => {
		try {
			verify(forged, secret);
			return true;
		} catch {
			return false;
		}
	};

	it('CONTROL: the pre-fix stored secret verifies a forged token', () => {
		expect(acceptsForgery(PRE_FIX_STORED.jwt)).toBe(true);
	});

	it('first run: generates all four secrets, random and distinct', () => {
		const { secret, changed } = ensureDesktopSecrets(undefined);

		expect(changed).toBe(true);
		const values = Object.values(secret);
		expect(Object.keys(secret).sort()).toEqual(['jwt', 'refresh_token', 'session', 'verification_token']);
		for (const value of values) {
			expect(value).toMatch(/^[0-9a-f]{128}$/);
			expect(isKnownDefaultSecret(value)).toBe(false);
		}
		expect(new Set(values).size).toBe(4);
	});

	it('first run from the setup screen: blank values (the new build default) are generated', () => {
		const { secret, changed } = ensureDesktopSecrets({ jwt: '', refresh_token: '  ' });

		expect(changed).toBe(true);
		expect(secret.jwt).toMatch(/^[0-9a-f]{128}$/);
		expect(secret.refresh_token).toMatch(/^[0-9a-f]{128}$/);
	});

	it('upgrade: replaces the stored published defaults, so the forged token stops verifying', () => {
		const { secret, changed } = ensureDesktopSecrets(PRE_FIX_STORED);

		expect(changed).toBe(true);
		expect(secret.jwt).not.toBe('secretKey');
		expect(secret.refresh_token).not.toBe('refreshTokenSecretKey');
		expect(acceptsForgery(secret.jwt)).toBe(false);
	});

	it('keeps strong stored values unchanged, so restarts keep sessions (idempotent)', () => {
		const first = ensureDesktopSecrets(undefined).secret;
		const second = ensureDesktopSecrets(first);

		expect(second.changed).toBe(false);
		expect(second.secret).toEqual(first);
	});

	it('keeps a value the user typed, and fills only what is missing', () => {
		const generate = jest.fn(() => 'generated');
		const { secret, changed } = ensureDesktopSecrets(
			{ jwt: 'user-chosen-jwt-secret', refresh_token: 'user-chosen-refresh-secret' },
			generate
		);

		expect(changed).toBe(true);
		expect(secret).toEqual({
			jwt: 'user-chosen-jwt-secret',
			refresh_token: 'user-chosen-refresh-secret',
			verification_token: 'generated',
			session: 'generated'
		});
		expect(generate).toHaveBeenCalledTimes(2);
	});

	it('does not mutate the stored object', () => {
		const stored = { ...PRE_FIX_STORED };
		ensureDesktopSecrets(stored);

		expect(stored).toEqual(PRE_FIX_STORED);
	});

	it('maps every secret to the variable the local API reads', () => {
		const { secret } = ensureDesktopSecrets(undefined);

		expect(desktopSecretsToEnv(secret)).toEqual({
			JWT_SECRET: secret.jwt,
			JWT_REFRESH_TOKEN_SECRET: secret.refresh_token,
			JWT_VERIFICATION_TOKEN_SECRET: secret.verification_token,
			EXPRESS_SESSION_SECRET: secret.session
		});
		expect(Object.values(DESKTOP_SECRET_ENV)).toHaveLength(4);
	});

	it('redacts the secrets from what the launchers log', () => {
		const { secret } = ensureDesktopSecrets(undefined);
		const logged = JSON.stringify(
			redactSecretsForLog({ API_PORT: '3000', DB_PASS: 'db-password', ...desktopSecretsToEnv(secret), secret })
		);

		expect(logged).toContain('"API_PORT":"3000"');
		for (const value of [...Object.values(secret), 'db-password']) {
			expect(logged).not.toContain(value);
		}
	});
});

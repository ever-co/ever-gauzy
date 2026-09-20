import { environment, resolveSecret } from '@gauzy/config';
import { validateApplicationSecrets } from './validate-secrets';

/**
 * Regression suite for GHSA-39j7-x845-4w3c / GHSA-chm8-2ggf-pgjq.
 *
 * `@gauzy/config` no longer falls back to a published literal when a secret is unset (outside
 * DEMO): it substitutes a random per-process value. The startup guard must still see that as
 * "not configured" and refuse a production boot, exactly as it did for the literal. It also checks
 * every key against the ONE shared published list, so a literal shipped for another key (or by the
 * desktop build) is caught too.
 *
 * Each case that needed a change carries a CONTROL running the pre-fix predicate, which accepts it.
 */
describe('validateApplicationSecrets', () => {
	const KEYS = ['JWT_SECRET', 'JWT_REFRESH_TOKEN_SECRET', 'JWT_VERIFICATION_TOKEN_SECRET', 'EXPRESS_SESSION_SECRET'];
	const MANAGED = ['NODE_ENV', 'DEMO', 'ALLOW_INSECURE_JWT_SECRET', ...KEYS];
	const REGISTRY = Symbol.for('@gauzy/config:generated-secrets');

	/** The pre-fix predicate: weak only when empty or equal to that key's OWN literal. */
	const PRE_FIX_DEFAULTS: Record<string, string> = {
		JWT_SECRET: 'secretKey',
		JWT_REFRESH_TOKEN_SECRET: 'refreshSecretKey',
		JWT_VERIFICATION_TOKEN_SECRET: 'verificationSecretKey',
		EXPRESS_SESSION_SECRET: 'gauzy'
	};
	const preFixIsWeak = (key: string) => {
		const current = String((env()[key] as string | undefined) ?? process.env[key] ?? '').trim();
		return !current || current === PRE_FIX_DEFAULTS[key];
	};

	const env = () => environment as unknown as Record<string, unknown>;

	let saved: Record<string, string | undefined>;
	let savedEnvironment: Record<string, unknown>;
	let savedProduction: boolean;
	let error: jest.SpyInstance;
	let warn: jest.SpyInstance;

	/** Sets a secret the way a deployment does: in process.env and in the config object read at import. */
	const setSecret = (key: string, value: string) => {
		process.env[key] = value;
		env()[key] = value;
	};

	/** Leaves a secret unset: the config object then holds whatever `resolveSecret` substitutes. */
	const unsetSecret = (key: string) => {
		delete process.env[key];
		env()[key] = resolveSecret(key, PRE_FIX_DEFAULTS[key]);
	};

	const setStrongSecrets = () => KEYS.forEach((key) => setSecret(key, `strong-${key}-7f3c9a1e5b`));

	beforeEach(() => {
		saved = Object.fromEntries(MANAGED.map((key) => [key, process.env[key]]));
		savedEnvironment = Object.fromEntries(KEYS.map((key) => [key, env()[key]]));
		savedProduction = environment.production;
		for (const key of MANAGED) {
			delete process.env[key];
		}
		delete (globalThis as any)[REGISTRY];
		environment.production = false;
		error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => {
		for (const key of MANAGED) {
			if (saved[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = saved[key];
			}
		}
		Object.assign(env(), savedEnvironment);
		environment.production = savedProduction;
		delete (globalThis as any)[REGISTRY];
		error.mockRestore();
		warn.mockRestore();
	});

	describe('production, non-demo', () => {
		beforeEach(() => {
			process.env.NODE_ENV = 'production';
			setStrongSecrets();
		});

		it('starts with strong secrets (positive control)', () => {
			expect(() => validateApplicationSecrets()).not.toThrow();
			expect(error).not.toHaveBeenCalled();
		});

		it('refuses an unset secret even though the config now holds a random value for it', () => {
			unsetSecret('JWT_SECRET');

			// CONTROL: the pre-fix predicate sees a non-empty, non-default value and lets it through.
			expect(preFixIsWeak('JWT_SECRET')).toBe(false);
			expect(() => validateApplicationSecrets()).toThrow(/Refusing to start: JWT_SECRET/);
		});

		it('refuses a published literal shipped for ANOTHER key', () => {
			setSecret('JWT_SECRET', 'refreshSecretKey');

			expect(preFixIsWeak('JWT_SECRET')).toBe(false); // CONTROL
			expect(() => validateApplicationSecrets()).toThrow(/JWT_SECRET/);
		});

		it('refuses the desktop build default refreshTokenSecretKey', () => {
			setSecret('JWT_REFRESH_TOKEN_SECRET', 'refreshTokenSecretKey');

			expect(preFixIsWeak('JWT_REFRESH_TOKEN_SECRET')).toBe(false); // CONTROL
			expect(() => validateApplicationSecrets()).toThrow(/JWT_REFRESH_TOKEN_SECRET/);
		});

		it('still refuses each key’s own literal and whitespace-only values', () => {
			setSecret('EXPRESS_SESSION_SECRET', 'gauzy');
			setSecret('JWT_VERIFICATION_TOKEN_SECRET', '   ');

			expect(() => validateApplicationSecrets()).toThrow(/JWT_VERIFICATION_TOKEN_SECRET, EXPRESS_SESSION_SECRET/);
		});

		it('keeps the explicit ALLOW_INSECURE_JWT_SECRET opt-out', () => {
			unsetSecret('JWT_SECRET');
			process.env.ALLOW_INSECURE_JWT_SECRET = 'true';

			expect(() => validateApplicationSecrets()).not.toThrow();
			expect(error).toHaveBeenCalled();
		});
	});

	describe('exempt from the hard failure, but warned', () => {
		it('DEMO=true in production', () => {
			process.env.NODE_ENV = 'production';
			process.env.DEMO = 'true';
			setStrongSecrets();
			setSecret('JWT_SECRET', 'secretKey');

			expect(() => validateApplicationSecrets()).not.toThrow();
			expect(error).toHaveBeenCalled();
		});

		it('development with unset secrets', () => {
			process.env.NODE_ENV = 'development';
			KEYS.forEach(unsetSecret);

			expect(() => validateApplicationSecrets()).not.toThrow();
			expect(String(error.mock.calls[0][0])).toContain('JWT_SECRET');
		});
	});
});

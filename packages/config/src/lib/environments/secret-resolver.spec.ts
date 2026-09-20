import { sign, verify } from 'jsonwebtoken';
import { KNOWN_DEFAULT_SECRETS, isKnownDefaultSecret } from '@gauzy/contracts';
import { isGeneratedSecret, resolveSecret } from './secret-resolver';

/**
 * Regression suite for GHSA-39j7-x845-4w3c (incomplete fix of GHSA-chm8-2ggf-pgjq).
 *
 * `environment.ts` / `default-config.ts` resolved every signing and session secret as
 * `process.env.X || '<published literal>'`. The startup guard refuses that only for
 * NODE_ENV=production, so any other runtime (`yarn start`, pm2, fly with NODE_ENV=development, the
 * desktop server) signed access tokens with `secretKey`, and anyone who knew a user id could forge a
 * token for that user.
 *
 * Every "the fix works" assertion is paired with a CONTROL that runs the pre-fix expression and
 * shows the forgery succeeding against it.
 */
describe('resolveSecret (GHSA-39j7-x845-4w3c)', () => {
	const MANAGED = [
		'NODE_ENV',
		'DEMO',
		'JWT_SECRET',
		'JWT_REFRESH_TOKEN_SECRET',
		// The `config surfaces` cases load environment.ts, which resolves this one too: it must be
		// unset here as well, or a value in the developer's shell makes them fail.
		'JWT_VERIFICATION_TOKEN_SECRET',
		'EXPRESS_SESSION_SECRET'
	];
	const REGISTRY = Symbol.for('@gauzy/config:generated-secrets');
	const WARNED = Symbol.for('@gauzy/config:warned-secrets');

	/** The exact pre-fix expression from environment.ts. */
	const preFixJwtSecret = () => process.env.JWT_SECRET || 'secretKey';

	/** An attacker's forged access token for a known user id, signed with the published literal. */
	const forgedToken = () => sign({ id: 'victim-user-id', tenantId: 'tenant-id' }, 'secretKey');

	const acceptsForgery = (secret: string) => {
		try {
			verify(forgedToken(), secret);
			return true;
		} catch {
			return false;
		}
	};

	let saved: Record<string, string | undefined>;
	let warn: jest.SpyInstance;

	beforeEach(() => {
		saved = Object.fromEntries(MANAGED.map((key) => [key, process.env[key]]));
		for (const key of MANAGED) {
			delete process.env[key];
		}
		process.env.NODE_ENV = 'development';
		delete (globalThis as any)[REGISTRY];
		delete (globalThis as any)[WARNED];
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
		delete (globalThis as any)[REGISTRY];
		delete (globalThis as any)[WARNED];
		warn.mockRestore();
	});

	describe('unset in development', () => {
		it('CONTROL: the pre-fix fallback signs with the published literal, so a forged token verifies', () => {
			expect(preFixJwtSecret()).toBe('secretKey');
			expect(acceptsForgery(preFixJwtSecret())).toBe(true);
		});

		it('returns a random 512-bit secret instead, which rejects the forged token', () => {
			const secret = resolveSecret('JWT_SECRET');

			expect(secret).toMatch(/^[0-9a-f]{128}$/);
			expect(isKnownDefaultSecret(secret)).toBe(false);
			expect(acceptsForgery(secret)).toBe(false);
		});

		it('returns the same value for the same name within the process, and a different one per name', () => {
			const first = resolveSecret('JWT_SECRET');

			expect(resolveSecret('JWT_SECRET')).toBe(first);
			expect(resolveSecret('JWT_REFRESH_TOKEN_SECRET')).not.toBe(first);
		});

		it('treats a whitespace-only value as unset', () => {
			process.env.JWT_SECRET = '   ';

			expect(resolveSecret('JWT_SECRET')).toMatch(/^[0-9a-f]{128}$/);
		});

		it('warns once, naming the variable but never printing the value', () => {
			const secret = resolveSecret('JWT_SECRET');
			resolveSecret('JWT_SECRET');

			expect(warn).toHaveBeenCalledTimes(1);
			const message = String(warn.mock.calls[0][0]);
			expect(message).toContain('JWT_SECRET');
			expect(message).not.toContain(secret);
		});

		it('marks the value as generated, so the startup guard can still report it as unset', () => {
			const secret = resolveSecret('JWT_SECRET');

			expect(isGeneratedSecret('JWT_SECRET', secret)).toBe(true);
			expect(isGeneratedSecret('JWT_SECRET', 'some-other-value')).toBe(false);
			expect(isGeneratedSecret('JWT_REFRESH_TOKEN_SECRET', secret)).toBe(false);
		});
	});

	describe('unset in production (non-demo)', () => {
		it('never returns the published literal either', () => {
			process.env.NODE_ENV = 'production';

			const secret = resolveSecret('JWT_SECRET');

			expect(secret).not.toBe('secretKey');
			expect(isGeneratedSecret('JWT_SECRET', secret)).toBe(true);
		});
	});

	describe('explicitly set', () => {
		it('returns a strong value exactly as provided, without warning', () => {
			process.env.JWT_SECRET = '  a-strong-operator-secret-with-spaces  ';

			expect(resolveSecret('JWT_SECRET')).toBe('  a-strong-operator-secret-with-spaces  ');
			expect(warn).not.toHaveBeenCalled();
		});

		it('keeps an explicit published value in development (e.g. .env.local), but warns', () => {
			process.env.JWT_SECRET = 'secretKey';

			expect(resolveSecret('JWT_SECRET')).toBe('secretKey');
			expect(warn).toHaveBeenCalledTimes(1);
			expect(String(warn.mock.calls[0][0])).toContain('JWT_SECRET');
			expect(isGeneratedSecret('JWT_SECRET', 'secretKey')).toBe(false);
		});
	});

	describe('DEMO=true', () => {
		it('CONTROL: the exemption used to hand a public demo the published literal', () => {
			process.env.DEMO = 'true';

			// What the DEMO branch returned before: `process.env[name] || '<published literal>'`.
			expect(preFixJwtSecret()).toBe('secretKey');
			expect(acceptsForgery(preFixJwtSecret())).toBe(true);
		});

		it('is not exempt: an unset secret gets the same random value as anywhere else', () => {
			process.env.DEMO = 'true';

			const secret = resolveSecret('JWT_SECRET');

			expect(secret).toMatch(/^[0-9a-f]{128}$/);
			expect(isKnownDefaultSecret(secret)).toBe(false);
			expect(acceptsForgery(secret)).toBe(false);
			expect(resolveSecret('EXPRESS_SESSION_SECRET')).not.toBe('gauzy');
		});

		it('still uses an explicitly set value, which is how every deployment runs', () => {
			process.env.DEMO = 'true';
			process.env.JWT_SECRET = 'demo-store-secret';

			expect(resolveSecret('JWT_SECRET')).toBe('demo-store-secret');
			expect(warn).not.toHaveBeenCalled();
		});
	});

	describe('config surfaces', () => {
		/** Loads a fresh copy of a config module with the current process.env, without reading any .env file. */
		const loadFresh = <T>(path: string): T => {
			let loaded: T;
			jest.isolateModules(() => {
				jest.doMock('dotenv', () => ({ config: jest.fn() }));
				loaded = require(path);
			});
			return loaded;
		};

		it('environment.ts never exposes a published literal for an unset secret outside DEMO', () => {
			const { environment } = loadFresh<typeof import('./environment')>('./environment');

			for (const key of [
				'JWT_SECRET',
				'JWT_REFRESH_TOKEN_SECRET',
				'JWT_VERIFICATION_TOKEN_SECRET',
				'EXPRESS_SESSION_SECRET'
			] as const) {
				expect(isKnownDefaultSecret(environment[key])).toBe(false);
				expect(environment[key]).toMatch(/^[0-9a-f]{128}$/);
			}
			expect(acceptsForgery(environment.JWT_SECRET)).toBe(false);
		});

		it('default-config.ts agrees with environment.ts on the per-process value', () => {
			const { environment } = loadFresh<typeof import('./environment')>('./environment');
			const { defaultConfiguration } = loadFresh<typeof import('../default-config')>('../default-config');

			expect(defaultConfiguration.authOptions.jwtSecret).toBe(environment.JWT_SECRET);
			expect(defaultConfiguration.authOptions.expressSessionSecret).toBe(environment.EXPRESS_SESSION_SECRET);
		});

		// The API's entry point calls loadEnv() (which reads .env.local and friends) only AFTER its
		// imports have run, so this module can be evaluated while JWT_SECRET is still unset. Resolving
		// eagerly there decided the secret too early: this copy generated a random value, a copy
		// imported after loadEnv() read the configured one, and tokens signed with one were rejected by
		// the other — a 401 on every authenticated request. The published literal used to hide it,
		// because both copies then landed on the same literal.
		it('reads a secret configured AFTER this module was imported (load order)', () => {
			const { environment } = loadFresh<typeof import('./environment')>('./environment');
			const { defaultConfiguration } = loadFresh<typeof import('../default-config')>('../default-config');

			// Imported with nothing set: a random per-process value, as above.
			expect(environment.JWT_SECRET).toMatch(/^[0-9a-f]{128}$/);

			// ...then the env file is loaded, exactly as loadEnv() does at startup.
			process.env.JWT_SECRET = 'configured-by-load-env';

			expect(environment.JWT_SECRET).toBe('configured-by-load-env');
			expect(defaultConfiguration.authOptions.jwtSecret).toBe('configured-by-load-env');
		});
	});

	it('KNOWN_DEFAULT_SECRETS covers every literal the repository has shipped as a secret', () => {
		for (const literal of ['secretKey', 'refreshSecretKey', 'refreshTokenSecretKey', 'verificationSecretKey', 'gauzy']) {
			expect(KNOWN_DEFAULT_SECRETS).toContain(literal);
			expect(isKnownDefaultSecret(` ${literal.toUpperCase()} `)).toBe(true);
		}
		expect(isKnownDefaultSecret('')).toBe(false);
		expect(isKnownDefaultSecret(undefined)).toBe(false);
	});
});

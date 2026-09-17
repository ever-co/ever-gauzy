import { environment } from '@gauzy/config';
import { validateSeedCredentials } from './validate-secrets';

/**
 * Regression suite for GHSA-4r2r-mv32-3468.
 *
 * The first boot against an empty database seeded a SUPER_ADMIN (`admin@ever.co` / `admin`), an
 * ADMIN (`local.admin@ever.co` / `admin`) and an EMPLOYEE (`employee@ever.co` / `12345678`)
 * regardless of `DEMO`, using passwords printed in this repository's own README. Nothing warned and
 * nothing blocked, so a deployment that followed the README's "Production" instructions was live on
 * publicly known credentials.
 *
 * The guard mirrors `validateApplicationSecrets` (GHSA-chm8-2ggf-pgjq): warn everywhere, refuse in
 * a real production deployment, with demo and the Electron desktop server exempt.
 */
describe('validateSeedCredentials', () => {
	/** Which `environment.demoCredentialConfig` field each variable feeds. */
	const CONFIG_FIELD = {
		DEMO_SUPER_ADMIN_PASSWORD: 'superAdminPassword',
		DEMO_ADMIN_PASSWORD: 'adminPassword',
		DEMO_EMPLOYEE_PASSWORD: 'employeePassword'
	} as const;

	const MANAGED = [
		'NODE_ENV',
		'DEMO',
		'IS_ELECTRON',
		'ALLOW_INSECURE_SEED_CREDENTIALS',
		'DEMO_SUPER_ADMIN_PASSWORD',
		'DEMO_ADMIN_PASSWORD',
		'DEMO_EMPLOYEE_PASSWORD'
	];

	let saved: Record<string, string | undefined>;
	let savedCredentials: Record<string, string>;
	let savedFlags: { production: boolean; demo?: boolean; isElectron?: boolean };
	let error: jest.SpyInstance;

	beforeEach(() => {
		saved = Object.fromEntries(MANAGED.map((key) => [key, process.env[key]]));
		// Start from "nothing configured", which is exactly the state the README's production path
		// produced and the state the advisory is about.
		for (const key of MANAGED) {
			delete process.env[key];
		}

		// `environment` was frozen from the ambient process env when @gauzy/config was first
		// imported, so pin it to the SHIPPED DEFAULTS here: without this, a developer machine that
		// happens to carry a .env would make "unset" mean something different for them than for CI.
		savedCredentials = { ...(environment.demoCredentialConfig as Record<string, string>) };
		savedFlags = {
			production: environment.production,
			demo: environment.demo,
			isElectron: environment.isElectron
		};
		Object.assign(environment.demoCredentialConfig, {
			superAdminPassword: 'admin',
			adminPassword: 'admin',
			employeePassword: '12345678'
		});
		environment.production = false;
		environment.demo = false;
		environment.isElectron = false;

		error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		for (const key of MANAGED) {
			if (saved[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = saved[key];
			}
		}
		Object.assign(environment.demoCredentialConfig, savedCredentials);
		environment.production = savedFlags.production;
		environment.demo = savedFlags.demo;
		environment.isElectron = savedFlags.isElectron;
		error.mockRestore();
	});

	/**
	 * Sets one seed password the way a deployment does: in the environment AND in the config object the
	 * seeder reads it from (which @gauzy/config fills from the environment once, at import).
	 */
	const setSeedPassword = (key: keyof typeof CONFIG_FIELD, value: string) => {
		process.env[key] = value;
		(environment.demoCredentialConfig as Record<string, string>)[CONFIG_FIELD[key]] = value;
	};

	/** Sets every seed password to a value nobody could have read in the README. */
	const setStrongSeedPasswords = () => {
		setSeedPassword('DEMO_SUPER_ADMIN_PASSWORD', 'cJ8-rotated-super-admin');
		setSeedPassword('DEMO_ADMIN_PASSWORD', 'cJ8-rotated-admin');
		setSeedPassword('DEMO_EMPLOYEE_PASSWORD', 'cJ8-rotated-employee');
	};

	describe('production, non-demo', () => {
		beforeEach(() => {
			process.env.NODE_ENV = 'production';
		});

		it('refuses to seed when the passwords are unset', () => {
			expect(() => validateSeedCredentials()).toThrow(/Refusing to seed/);
			expect(() => validateSeedCredentials()).toThrow(/DEMO_SUPER_ADMIN_PASSWORD/);
			expect(() => validateSeedCredentials()).toThrow(/DEMO_ADMIN_PASSWORD/);
			expect(() => validateSeedCredentials()).toThrow(/DEMO_EMPLOYEE_PASSWORD/);
		});

		it('refuses when a password is explicitly set to the shipped default', () => {
			setStrongSeedPasswords();
			setSeedPassword('DEMO_SUPER_ADMIN_PASSWORD', 'admin');

			expect(() => validateSeedCredentials()).toThrow(/DEMO_SUPER_ADMIN_PASSWORD/);
			expect(() => validateSeedCredentials()).not.toThrow(/DEMO_EMPLOYEE_PASSWORD/);
		});

		it('refuses on the ADMIN and EMPLOYEE defaults too, not only the super admin', () => {
			setStrongSeedPasswords();
			setSeedPassword('DEMO_ADMIN_PASSWORD', 'admin');
			expect(() => validateSeedCredentials()).toThrow(/DEMO_ADMIN_PASSWORD/);

			setStrongSeedPasswords();
			setSeedPassword('DEMO_EMPLOYEE_PASSWORD', '12345678');
			expect(() => validateSeedCredentials()).toThrow(/DEMO_EMPLOYEE_PASSWORD/);
		});

		it('treats a whitespace-only password as unset', () => {
			setStrongSeedPasswords();
			setSeedPassword('DEMO_SUPER_ADMIN_PASSWORD', '   ');

			expect(() => validateSeedCredentials()).toThrow(/DEMO_SUPER_ADMIN_PASSWORD/);
		});

		it('allows the seed once every password is rotated, and says nothing', () => {
			setStrongSeedPasswords();

			expect(() => validateSeedCredentials()).not.toThrow();
			expect(error).not.toHaveBeenCalled();
		});

		it('judges the password the seeder will hash, not a variable changed after the config was read', () => {
			// The seed arrays are built from `environment.demoCredentialConfig`, which still holds the
			// published defaults here. A later process.env value must not make the check pass.
			process.env.DEMO_SUPER_ADMIN_PASSWORD = 'cJ8-rotated-super-admin';
			process.env.DEMO_ADMIN_PASSWORD = 'cJ8-rotated-admin';
			process.env.DEMO_EMPLOYEE_PASSWORD = 'cJ8-rotated-employee';

			expect(() => validateSeedCredentials()).toThrow(/DEMO_SUPER_ADMIN_PASSWORD/);
		});

		it('refuses a seed that creates the hard-coded fixture accounts, even with rotated passwords', () => {
			setStrongSeedPasswords();

			expect(() => validateSeedCredentials({ createsFixtureAccounts: true })).toThrow(/DEFAULT_EVER_EMPLOYEES/);
			expect(() => validateSeedCredentials({ createsFixtureAccounts: false })).not.toThrow();
		});

		it('honours the documented emergency override, loudly', () => {
			process.env.ALLOW_INSECURE_SEED_CREDENTIALS = 'true';

			expect(() => validateSeedCredentials()).not.toThrow();
			expect(error).toHaveBeenCalled();
			expect(error.mock.calls.some(([line]) => String(line).includes('ALLOW_INSECURE_SEED_CREDENTIALS'))).toBe(
				true
			);
		});
	});

	it('refuses on a production BUILD even when NODE_ENV does not say production', () => {
		environment.production = true;

		delete process.env.NODE_ENV;
		expect(() => validateSeedCredentials()).toThrow(/Refusing to seed/);

		process.env.NODE_ENV = 'development';
		expect(() => validateSeedCredentials()).toThrow(/Refusing to seed/);
	});

	it('keeps a demo boot working, fixture accounts included', () => {
		process.env.NODE_ENV = 'production';
		process.env.DEMO = 'true';

		expect(() => validateSeedCredentials({ createsFixtureAccounts: true })).not.toThrow();
	});

	it('warns but keeps demo deployments working', () => {
		process.env.NODE_ENV = 'production';
		process.env.DEMO = 'true';

		expect(() => validateSeedCredentials()).not.toThrow();
		// Still announced: demo.gauzy.co publishes these credentials on purpose, but the operator of a
		// copy of that stack should see them called out.
		expect(error).toHaveBeenCalled();
	});

	it('warns but keeps the Electron desktop server working', () => {
		process.env.NODE_ENV = 'production';
		process.env.IS_ELECTRON = 'true';

		expect(() => validateSeedCredentials()).not.toThrow();
		expect(error).toHaveBeenCalled();
	});

	it('warns but does not block local development or CI', () => {
		process.env.NODE_ENV = 'development';

		expect(() => validateSeedCredentials()).not.toThrow();
		expect(error).toHaveBeenCalled();
	});
});

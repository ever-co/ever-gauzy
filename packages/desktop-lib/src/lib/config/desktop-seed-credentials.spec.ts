import {
	DESKTOP_SEED_ACCOUNTS,
	desktopSeedCredentialsToEnv,
	ensureDesktopSeedCredentials,
	findDesktopSeededAccounts,
	generateDesktopSeedPassword,
	parseDesktopSeedAccountEmails,
	parsePublishedPasswordAccounts,
	reportsDesktopSeedCompleted,
	reportsDesktopSeedStarted
} from './desktop-seed-credentials';

/**
 * Owner decision 8 (2026-10-22), GHSA-4r2r-mv32-3468 desktop residual.
 *
 * The desktop apps that run the API locally passed no `DEMO_*_PASSWORD`, so the first start seeded
 * `admin@ever.co` / `admin`, `local.admin@ever.co` / `admin` and `employee@ever.co` / `12345678`,
 * the passwords printed in the README. Each install now generates its own and passes them to the API.
 *
 * Electron cannot run here, so the decision logic is pure and tested directly.
 */
describe('desktop seed credentials', () => {
	const PUBLISHED = ['admin', '12345678'];

	describe('generateDesktopSeedPassword', () => {
		it('makes 24 URL-safe random characters, never a published default, never twice the same', () => {
			const values = Array.from({ length: 50 }, () => generateDesktopSeedPassword());

			for (const value of values) {
				expect(value).toMatch(/^[A-Za-z0-9_-]{24}$/);
				expect(PUBLISHED).not.toContain(value);
			}
			expect(new Set(values).size).toBe(values.length);
		});
	});

	describe('ensureDesktopSeedCredentials', () => {
		let counter: number;
		const generate = () => `generated-password-${String(++counter).padStart(4, '0')}`;

		beforeEach(() => {
			counter = 0;
		});

		it('first run: generates a distinct password for each of the three accounts', () => {
			const { credentials, changed } = ensureDesktopSeedCredentials(undefined);

			expect(changed).toBe(true);
			const values = DESKTOP_SEED_ACCOUNTS.map(({ key }) => credentials[key]);
			expect(values).toHaveLength(3);
			for (const value of values) {
				expect(value).toMatch(/^[A-Za-z0-9_-]{24}$/);
			}
			expect(new Set(values).size).toBe(3);
			expect(credentials.pending).toBeUndefined();
		});

		it('keeps stored passwords, so every start passes the same ones until a seed uses them', () => {
			const first = ensureDesktopSeedCredentials(undefined, generate).credentials;
			const second = ensureDesktopSeedCredentials(first, generate);

			expect(second.changed).toBe(false);
			expect(second.credentials).toEqual(first);
		});

		it('replaces a short, blank or whitespace value, and a published default typed into the store', () => {
			const { credentials, changed } = ensureDesktopSeedCredentials(
				{ superAdmin: 'admin', admin: '   ', employee: 'has a space in it, long enough' },
				generate
			);

			expect(changed).toBe(true);
			expect(credentials.superAdmin).toBe('generated-password-0001');
			expect(credentials.admin).toBe('generated-password-0002');
			expect(credentials.employee).toBe('generated-password-0003');
		});

		it('never replaces a password a seed already used, whatever it looks like', () => {
			const stored = {
				superAdmin: 'short',
				admin: 'generated-password-9999',
				employee: 'generated-password-8888',
				pending: [{ key: 'superAdmin' as const, email: 'admin@ever.co' }]
			};

			const { credentials, changed } = ensureDesktopSeedCredentials(stored, generate);

			expect(changed).toBe(false);
			expect(credentials.superAdmin).toBe('short');
			expect(credentials.pending).toEqual(stored.pending);
		});

		it('forgets a pending account whose password went missing, rather than show a wrong one', () => {
			const { credentials, changed } = ensureDesktopSeedCredentials(
				{
					admin: 'generated-password-9999',
					employee: 'generated-password-8888',
					pending: [
						{ key: 'superAdmin', email: 'admin@ever.co' },
						{ key: 'admin', email: 'local.admin@ever.co' }
					]
				},
				generate
			);

			expect(changed).toBe(true);
			expect(credentials.pending).toEqual([{ key: 'admin', email: 'local.admin@ever.co' }]);
			expect(credentials.superAdmin).toBe('generated-password-0001');
		});

		it('does not modify what it was given', () => {
			const stored = Object.freeze({ superAdmin: '' });

			expect(() => ensureDesktopSeedCredentials(stored, generate)).not.toThrow();
			expect(stored).toEqual({ superAdmin: '' });
		});
	});

	describe('desktopSeedCredentialsToEnv', () => {
		const credentials = {
			superAdmin: 'generated-super-admin-1',
			admin: 'generated-admin-0000001',
			employee: 'generated-employee-0001'
		};

		it('hands each generated password to the variable the API seeds that account from', () => {
			expect(desktopSeedCredentialsToEnv(credentials)).toEqual({
				DEMO_SUPER_ADMIN_PASSWORD: 'generated-super-admin-1',
				DEMO_ADMIN_PASSWORD: 'generated-admin-0000001',
				DEMO_EMPLOYEE_PASSWORD: 'generated-employee-0001'
			});
		});

		it("leaves a password the operator set in the app's environment to them", () => {
			const env = desktopSeedCredentialsToEnv(credentials, {
				DEMO_SUPER_ADMIN_PASSWORD: 'operator-chosen',
				DEMO_ADMIN_PASSWORD: '  '
			});

			expect(env).toEqual({
				DEMO_ADMIN_PASSWORD: 'generated-admin-0000001',
				DEMO_EMPLOYEE_PASSWORD: 'generated-employee-0001'
			});
		});
	});

	describe('findDesktopSeededAccounts', () => {
		const credentials = {
			superAdmin: 'generated-super-admin-1',
			admin: 'generated-admin-0000001',
			employee: 'generated-employee-0001'
		};

		/** What the API reports for a seed with its default emails (`Database Default Seed Accounts:`). */
		const reported = { superAdmin: 'admin@ever.co', admin: 'local.admin@ever.co', employee: 'employee@ever.co' };

		it('names every account seeded with its generated password, with the emails the API reported', () => {
			expect(findDesktopSeededAccounts(credentials, desktopSeedCredentialsToEnv(credentials), reported)).toEqual([
				{ key: 'superAdmin', email: 'admin@ever.co' },
				{ key: 'admin', email: 'local.admin@ever.co' },
				{ key: 'employee', email: 'employee@ever.co' }
			]);
		});

		it('uses the email the API was configured with when it reported none', () => {
			const env = { ...desktopSeedCredentialsToEnv(credentials), DEMO_SUPER_ADMIN_EMAIL: ' boss@example.com ' };

			expect(findDesktopSeededAccounts(credentials, env)[0]).toEqual({
				key: 'superAdmin',
				email: 'boss@example.com'
			});
		});

		it('prefers what the API reported: that is the email it seeded', () => {
			const env = { ...desktopSeedCredentialsToEnv(credentials), DEMO_SUPER_ADMIN_EMAIL: 'stale@example.com' };

			expect(findDesktopSeededAccounts(credentials, env, { superAdmin: ' boss@example.com ' })[0]).toEqual({
				key: 'superAdmin',
				email: 'boss@example.com'
			});
		});

		it('keeps no copy of the defaults: without a report or a variable the email is left empty', () => {
			expect(findDesktopSeededAccounts(credentials, desktopSeedCredentialsToEnv(credentials))).toEqual([
				{ key: 'superAdmin', email: '' },
				{ key: 'admin', email: '' },
				{ key: 'employee', email: '' }
			]);
		});

		it('leaves out an account the operator gave its own password', () => {
			const env = { ...desktopSeedCredentialsToEnv(credentials), DEMO_ADMIN_PASSWORD: 'operator-chosen' };

			expect(findDesktopSeededAccounts(credentials, env).map(({ key }) => key)).toEqual([
				'superAdmin',
				'employee'
			]);
		});

		it('finds nothing without stored passwords', () => {
			expect(findDesktopSeededAccounts(undefined, { DEMO_SUPER_ADMIN_PASSWORD: 'x' })).toEqual([]);
			expect(findDesktopSeededAccounts({}, {})).toEqual([]);
		});
	});

	describe('reading the API output', () => {
		it('recognises the end of the default seed, with or without terminal colours', () => {
			expect(reportsDesktopSeedCompleted('...\nDatabase Default Seed Completed\n')).toBe(true);
			expect(reportsDesktopSeedCompleted('\u001b[35mDatabase Default Seed Completed\u001b[39m\n')).toBe(true);
			expect(reportsDesktopSeedCompleted('Found 3 users in DB\nListening at http://127.0.0.1:3000/api')).toBe(
				false
			);
		});

		it('recognises the start of the default seed (or its end, if the start was missed)', () => {
			expect(reportsDesktopSeedStarted('Found 0 users in DB\nDatabase Default Seed Started\n')).toBe(true);
			expect(reportsDesktopSeedStarted('\u001b[35mDatabase Default Seed Started\u001b[39m\n')).toBe(true);
			expect(reportsDesktopSeedStarted('...\nDatabase Default Seed Completed\n')).toBe(true);
			expect(reportsDesktopSeedStarted('Database Demo Seed Started\n')).toBe(false);
			expect(reportsDesktopSeedStarted('Found 3 users in DB\nListening at http://127.0.0.1:3000/api')).toBe(false);
		});

		it('reads the accounts the boot check reports as still using a published password', () => {
			// What AppService.warnAboutPublishedSeedPasswords prints (chalk's padding spaces included).
			const line =
				'\u001b[41m\u001b[97m\u001b[1m INSECURE ACCOUNTS: admin@ever.co, local.admin@ever.co \u001b[22m\u001b[39m\u001b[49m\n';

			expect(parsePublishedPasswordAccounts(`stderr noise\n${line}more`)).toEqual([
				'admin@ever.co',
				'local.admin@ever.co'
			]);
		});

		it('waits for the whole line, so a line cut between two chunks is not read short', () => {
			expect(parsePublishedPasswordAccounts(' INSECURE ACCOUNTS: admin@ever.co, local.ad')).toEqual([]);
		});

		it('does not take the seed guard warning for it', () => {
			expect(parsePublishedPasswordAccounts(' INSECURE SEED CREDENTIALS: DEMO_SUPER_ADMIN_PASSWORD \n')).toEqual(
				[]
			);
		});

		it('reads the emails the API reports for its default seed, with or without terminal colours', () => {
			// What SeedDataService.runDefaultSeed prints just before "Database Default Seed Started".
			const line =
				'Database Default Seed Accounts: {"superAdmin":"admin@ever.co","admin":"local.admin@ever.co","employee":"employee@ever.co"}\n';

			expect(
				parseDesktopSeedAccountEmails(`Found 0 users in DB\n${line}Database Default Seed Started\n`)
			).toEqual({
				superAdmin: 'admin@ever.co',
				admin: 'local.admin@ever.co',
				employee: 'employee@ever.co'
			});
			expect(parseDesktopSeedAccountEmails(`\u001b[35m${line.trimEnd()}\u001b[39m\n`)).toEqual({
				superAdmin: 'admin@ever.co',
				admin: 'local.admin@ever.co',
				employee: 'employee@ever.co'
			});
		});

		it('waits for the whole accounts line, and reads nothing from a line that is not JSON', () => {
			expect(parseDesktopSeedAccountEmails('Database Default Seed Accounts: {"superAdmin":"admin@ev')).toEqual(
				{}
			);
			expect(parseDesktopSeedAccountEmails('Database Default Seed Accounts: admin@ever.co\n')).toEqual({});
			expect(parseDesktopSeedAccountEmails('Database Default Seed Started\n')).toEqual({});
		});

		it('leaves out an account the report gives no usable email', () => {
			expect(
				parseDesktopSeedAccountEmails(
					'Database Default Seed Accounts: {"superAdmin":" boss@example.com ","admin":"","employee":42,"other":"x@example.com"}\n'
				)
			).toEqual({ superAdmin: 'boss@example.com' });
		});
	});
});

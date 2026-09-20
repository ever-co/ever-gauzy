/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service.
 *
 * `dashboard.entity.ts` applies `@IsEmployeeBelongsToOrganization()` at class-definition time, and
 * that decorator's module reaches the entity graph again through the employee repository. Importing
 * the subject first enters the cycle from the wrong end: the decorator module is still initializing
 * when `dashboard.entity.ts` applies it, so it resolves to `undefined` and the whole suite fails to
 * LOAD with `IsEmployeeBelongsToOrganization is not a function`. Loading the entity barrel first
 * lets that module finish before anything applies it. The API does not hit this because Nest
 * bootstraps the entity graph before the service layer.
 */
import '../core/entities/internal';
import { Test, TestingModule } from '@nestjs/testing';
import { environment } from '@gauzy/config';
import { SeedDataService } from '../core/seeds/seed-data.service';
import { UserService } from '../user/user.service';
import { AppService } from './app.service';

/**
 * These tests replace an Nx scaffold that asserted `getData()` returned `'Welcome to api!'`.
 * `AppService` has never had a `getData` method — it exposes `seedDBIfEmpty` and `seedDemoIfEmpty`
 * — so the suite failed to COMPILE and every test in it silently never ran.
 *
 * The behaviour worth pinning is the guard, not the seeding: `seedDBIfEmpty` re-seeds ONLY when the
 * database holds no users. If that condition ever inverted, a deploy would re-seed a populated
 * production database — which is exactly why the method documents it as the safety check.
 */
describe('AppService', () => {
	let service: AppService;
	let seedDataService: jest.Mocked<Pick<SeedDataService, 'runDefaultSeed' | 'runDemoSeed'>>;
	let userService: jest.Mocked<Pick<UserService, 'countAll' | 'findAccountsUsingPasswords'>>;

	beforeEach(async () => {
		seedDataService = {
			runDefaultSeed: jest.fn().mockResolvedValue(undefined),
			runDemoSeed: jest.fn().mockResolvedValue(undefined)
		} as never;
		userService = {
			countAll: jest.fn(),
			findAccountsUsingPasswords: jest.fn().mockResolvedValue({ matches: [], inconclusive: [] })
		} as never;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AppService,
				{ provide: SeedDataService, useValue: seedDataService },
				{ provide: UserService, useValue: userService }
			]
		}).compile();

		service = module.get<AppService>(AppService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('seedDBIfEmpty', () => {
		it('seeds an empty database', async () => {
			userService.countAll.mockResolvedValue(0);

			await service.seedDBIfEmpty();

			expect(seedDataService.runDefaultSeed).toHaveBeenCalledWith(true);
			expect(service.userCount).toBe(0);
		});

		it('NEVER re-seeds a database that already has users', async () => {
			userService.countAll.mockResolvedValue(42);

			await service.seedDBIfEmpty();

			expect(seedDataService.runDefaultSeed).not.toHaveBeenCalled();
			expect(service.userCount).toBe(42);
		});
	});

	/**
	 * GHSA-4r2r-mv32-3468: the seed guard only protects NEW databases, so an install seeded before it
	 * keeps `admin@ever.co` / `admin` silently. Boot now warns (never refuses) when a seeded account
	 * still verifies against its published password.
	 */
	describe('published seed passwords on an existing database', () => {
		let error: jest.SpyInstance;
		let warn: jest.SpyInstance;
		let savedDemo: string | undefined;
		let savedEnvironmentDemo: boolean;

		beforeEach(() => {
			savedDemo = process.env.DEMO;
			savedEnvironmentDemo = environment.demo;
			delete process.env.DEMO;
			environment.demo = false;
			userService.countAll.mockResolvedValue(3);
			error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
			warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		});

		afterEach(() => {
			if (savedDemo === undefined) {
				delete process.env.DEMO;
			} else {
				process.env.DEMO = savedDemo;
			}
			environment.demo = savedEnvironmentDemo;
			error.mockRestore();
			warn.mockRestore();
		});

		const warned = () => error.mock.calls.map((call) => String(call[0])).join(' | ');

		it('checks the three seeded accounts against their published passwords, in one call', async () => {
			await service.seedDBIfEmpty();

			expect(userService.findAccountsUsingPasswords).toHaveBeenCalledTimes(1);
			expect(userService.findAccountsUsingPasswords.mock.calls[0][0]).toEqual([
				{ email: environment.demoCredentialConfig.superAdminEmail, password: 'admin' },
				{ email: environment.demoCredentialConfig.adminEmail, password: 'admin' },
				{ email: environment.demoCredentialConfig.employeeEmail, password: '12345678' }
			]);
		});

		it('also checks the CANONICAL published addresses when the configuration was changed later', async () => {
			// The database was seeded at some point in the past. An operator who set
			// DEMO_SUPER_ADMIN_EMAIL afterwards still has the original `admin@ever.co` row with the
			// published password; checking only today's configuration would walk straight past it.
			const credentials = environment.demoCredentialConfig as unknown as Record<string, string>;
			const saved = credentials.superAdminEmail;
			credentials.superAdminEmail = 'ops@example.com';
			try {
				await service.seedDBIfEmpty();

				const checked = userService.findAccountsUsingPasswords.mock.calls[0][0];
				expect(checked).toEqual(
					expect.arrayContaining([
						{ email: 'ops@example.com', password: 'admin' },
						{ email: 'admin@ever.co', password: 'admin' }
					])
				);
			} finally {
				credentials.superAdminEmail = saved;
			}
		});

		it('does not check the same address twice when the configuration is unchanged', async () => {
			await service.seedDBIfEmpty();

			const checked = userService.findAccountsUsingPasswords.mock.calls[0][0];
			expect(new Set(checked.map(({ email, password }) => `${email} :: ${password}`)).size).toBe(checked.length);
		});

		it('warns loudly when one still matches, and still never re-seeds', async () => {
			userService.findAccountsUsingPasswords.mockResolvedValue({ matches: ['admin@ever.co'], inconclusive: [] });

			await service.seedDBIfEmpty();

			expect(warned()).toContain('INSECURE ACCOUNTS: admin@ever.co');
			expect(seedDataService.runDefaultSeed).not.toHaveBeenCalled();
		});

		it('CONTROL: stays silent when every account was rotated', async () => {
			userService.findAccountsUsingPasswords.mockResolvedValue({ matches: [], inconclusive: [] });

			await service.seedDBIfEmpty();

			expect(warned()).not.toContain('INSECURE ACCOUNTS');
			expect(warn).not.toHaveBeenCalled();
		});

		it('says so when the check could not be exhaustive, instead of reading as clean', async () => {
			// The per-address row budget means a vulnerable tenant can sit outside the sample. A silent
			// boot would be indistinguishable from "checked, nothing found".
			userService.findAccountsUsingPasswords.mockResolvedValue({
				matches: [],
				inconclusive: ['admin@ever.co']
			});

			await service.seedDBIfEmpty();

			expect(String(warn.mock.calls[0][0])).toContain('not exhaustively');
			expect(String(warn.mock.calls[0][0])).toContain('admin@ever.co');
			// Still only a note: nothing was actually found, so it must not claim an insecure account.
			expect(warned()).not.toContain('INSECURE ACCOUNTS');
		});

		it('never blocks boot when the check fails', async () => {
			userService.findAccountsUsingPasswords.mockRejectedValue(new Error('database unavailable'));

			await expect(service.seedDBIfEmpty()).resolves.toBeUndefined();
			expect(warn).toHaveBeenCalled();
		});

		it('skips the demo, which publishes these credentials by design', async () => {
			process.env.DEMO = 'true';

			await service.seedDBIfEmpty();

			expect(userService.findAccountsUsingPasswords).not.toHaveBeenCalled();
		});

		it('does not run on an empty database (the seed guard covers that case)', async () => {
			userService.countAll.mockResolvedValue(0);

			await service.seedDBIfEmpty();

			expect(userService.findAccountsUsingPasswords).not.toHaveBeenCalled();
		});
	});

	describe('seedDemoIfEmpty', () => {
		it('never runs the demo seed once the database has users, whatever the demo flag says', async () => {
			userService.countAll.mockResolvedValue(7);
			await service.seedDBIfEmpty();

			await service.seedDemoIfEmpty();

			expect(seedDataService.runDemoSeed).not.toHaveBeenCalled();
		});
	});
});

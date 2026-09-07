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
	let userService: jest.Mocked<Pick<UserService, 'countAll'>>;

	beforeEach(async () => {
		seedDataService = {
			runDefaultSeed: jest.fn().mockResolvedValue(undefined),
			runDemoSeed: jest.fn().mockResolvedValue(undefined)
		} as never;
		userService = { countAll: jest.fn() } as never;

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

	describe('seedDemoIfEmpty', () => {
		it('never runs the demo seed once the database has users, whatever the demo flag says', async () => {
			userService.countAll.mockResolvedValue(7);
			await service.seedDBIfEmpty();

			await service.seedDemoIfEmpty();

			expect(seedDataService.runDemoSeed).not.toHaveBeenCalled();
		});
	});
});

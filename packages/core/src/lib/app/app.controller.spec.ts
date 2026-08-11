/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller.
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
import { ConfigService } from '@nestjs/config';
import { HttpStatus } from '@nestjs/common';
import { AppController } from './app.controller';

/**
 * These tests replace an Nx scaffold that asserted `getData()` returned `'Welcome to api!'`.
 * `AppController` has never had a `getData` method — it exposes `getAppStatus`, `getAppVersion`
 * and `getAppConfigs` — so the suite failed to COMPILE and every test in it silently never ran.
 */
describe('AppController', () => {
	const APP_NAME = 'Gauzy';

	/** Minimal `ConfigService` double: the controller only ever reads `app` and `setting`. */
	const configValues: Record<string, unknown> = {
		'app.app_name': APP_NAME,
		app: { app_name: APP_NAME, app_logo: 'logo.png' },
		setting: { email_verification: true }
	};

	let controller: AppController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AppController],
			providers: [
				{
					provide: ConfigService,
					useValue: { get: jest.fn((key: string) => configValues[key]) }
				}
			]
		}).compile();

		controller = module.get<AppController>(AppController);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	describe('getAppStatus', () => {
		it('reports OK and names the configured application', async () => {
			await expect(controller.getAppStatus()).resolves.toEqual({
				status: HttpStatus.OK,
				message: `${APP_NAME} API`
			});
		});
	});

	describe('getAppVersion', () => {
		it('identifies itself as the api and reports version + commit', () => {
			const version = controller.getAppVersion();

			expect(version.name).toBe('api');
			// Both are baked in at Docker build time via GAUZY_APP_VERSION / GAUZY_APP_COMMIT and
			// are empty when running from source, so assert the contract rather than the values.
			expect(typeof version.version).toBe('string');
			expect(typeof version.commit).toBe('string');
		});
	});

	describe('getAppConfigs', () => {
		it('merges application config and settings, and stamps timezone + date', async () => {
			const configs = (await controller.getAppConfigs()) as Record<string, unknown>;

			expect(configs).toMatchObject({
				app_name: APP_NAME,
				app_logo: 'logo.png',
				email_verification: true
			});
			expect(typeof configs['timezone']).toBe('string');
			expect(Number.isNaN(Date.parse(configs['date'] as string))).toBe(false);
		});
	});
});

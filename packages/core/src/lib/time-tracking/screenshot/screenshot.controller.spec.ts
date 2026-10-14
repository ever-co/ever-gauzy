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
import '../../core/entities/internal';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RequestContext } from '../../core/context';
import { FileStorage } from '../../core/file-storage';
import { ScreenshotController } from './screenshot.controller';
describe('Screenshot Controller', () => {
	let controller: ScreenshotController;
	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [ScreenshotController]
		})
			/**
			 * The original scaffold listed the subject with NO dependencies provided, so this suite
			 * could never have passed even once it loaded — it would have died on
			 * `Nest can't resolve dependencies`. Automocking every token keeps the suite honest
			 * about what it actually checks: that the class is constructible and its wiring holds.
			 */
			.useMocker(() => ({}))
			.compile();
		controller = module.get<ScreenshotController>(ScreenshotController);
	});
	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
});

/**
 * Found by the desktop timer e2e: a display the timer could not capture was uploaded as an EMPTY file. The
 * controller stored it, failed to make its thumbnail inside a try/catch that swallows every error, and answered
 * 201 with no screenshot — the client counted it as uploaded, nothing was recorded, a 0-byte file stayed behind.
 */
describe('Screenshot Controller — upload of an empty file', () => {
	let controller: ScreenshotController;
	const provider = {
		name: 'local',
		getFile: jest.fn(),
		deleteFile: jest.fn(),
		putFile: jest.fn()
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({ controllers: [ScreenshotController] })
			.useMocker(() => ({ create: jest.fn(), findOneByIdString: jest.fn(), publish: jest.fn() }))
			.compile();
		controller = module.get<ScreenshotController>(ScreenshotController);
		jest.spyOn(FileStorage.prototype, 'getProvider').mockReturnValue(provider as never);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1' } as never);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
		provider.getFile.mockResolvedValue(Buffer.alloc(0));
		provider.deleteFile.mockResolvedValue(undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('is refused with 400 and the stored file is deleted', async () => {
		const upload = controller.create({ organizationId: 'org-1' } as never, { key: 'screenshots/e.png', filename: 'e.png' } as never);

		await expect(upload).rejects.toBeInstanceOf(BadRequestException);
		expect(provider.deleteFile).toHaveBeenCalledWith('screenshots/e.png');
		expect(provider.putFile).not.toHaveBeenCalled();
	});
});

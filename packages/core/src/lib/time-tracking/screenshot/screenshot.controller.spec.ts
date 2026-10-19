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
import { Readable } from 'node:stream';
import { BadRequestException, InternalServerErrorException, PayloadTooLargeException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RequestContext } from '../../core/context';
import { FileStorage } from '../../core/file-storage';
import { MAX_BUFFERED_FILE_BYTES } from '../../core/file-storage/helpers/image-thumbnail';
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
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({ controllers: [ScreenshotController] })
			.useMocker(() => ({
				create: jest.fn().mockResolvedValue({ id: 'shot-1' }),
				findOneByIdString: jest.fn().mockResolvedValue({ id: 'shot-1' }),
				publish: jest.fn()
			}))
			.compile();
		controller = module.get<ScreenshotController>(ScreenshotController);
		jest.spyOn(FileStorage.prototype, 'getProvider').mockReturnValue(provider as never);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1' } as never);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
		provider.getFile.mockResolvedValue(Buffer.alloc(0));
		provider.deleteFile.mockResolvedValue(undefined);
		provider.putFile.mockResolvedValue({ key: 'screenshots/thumb-e.png' });
	});

	afterEach(() => jest.restoreAllMocks());

	it('is refused with 400 and the stored file is deleted', async () => {
		const upload = controller.create({ organizationId: 'org-1' } as never, { key: 'screenshots/e.png', filename: 'e.png' } as never);

		await expect(upload).rejects.toBeInstanceOf(BadRequestException);
		expect(provider.deleteFile).toHaveBeenCalledWith('screenshots/e.png');
		expect(provider.putFile).not.toHaveBeenCalled();
	});

	// The S3, Wasabi and DigitalOcean providers return the SDK's stream, not a Buffer.
	it('is refused as well when the provider returns the stored object as a stream', async () => {
		provider.getFile.mockResolvedValue(Readable.from([]));

		await expect(
			controller.create({ organizationId: 'org-1' } as never, { key: 'screenshots/e.png', filename: 'e.png' } as never)
		).rejects.toBeInstanceOf(BadRequestException);
		expect(provider.deleteFile).toHaveBeenCalledWith('screenshots/e.png');
	});

	it('answers an error, not a success, when the provider cannot read the object back', async () => {
		provider.getFile.mockResolvedValue(undefined);

		await expect(
			controller.create({ organizationId: 'org-1' } as never, { key: 'screenshots/u.png', filename: 'u.png' } as never)
		).rejects.toBeInstanceOf(InternalServerErrorException);
		expect(provider.deleteFile).not.toHaveBeenCalled();
	});

	it('is refused with 413 and the stored file is deleted when it is too large to read back (#11096 review)', async () => {
		provider.getFile.mockResolvedValue(Buffer.allocUnsafe(MAX_BUFFERED_FILE_BYTES + 1));

		await expect(
			controller.create({ organizationId: 'org-1' } as never, { key: 'screenshots/big.png', filename: 'big.png' } as never)
		).rejects.toBeInstanceOf(PayloadTooLargeException);
		expect(provider.deleteFile).toHaveBeenCalledWith('screenshots/big.png');
		expect(provider.putFile).not.toHaveBeenCalled();
	});

	it('still records a real image that a provider returns as a stream', async () => {
		// A 1x1 PNG.
		const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
		provider.getFile.mockResolvedValue(Readable.from([png]));

		const shot = await controller.create({ organizationId: 'org-1' } as never, { key: 'screenshots/s.png', filename: 's.png' } as never);

		expect(shot).toEqual({ id: 'shot-1' });
		expect(provider.putFile).toHaveBeenCalledWith(expect.any(Buffer), 'screenshots/thumb-s.png');
		expect(provider.deleteFile).not.toHaveBeenCalled();
	});
});

// Must stay first: see screenshot.controller.spec.ts.
import '../../core/entities/internal';

// The storage provider the upload reads back and writes the thumbnail to
const mockProvider = { name: 'local', getFile: jest.fn(), deleteFile: jest.fn(), putFile: jest.fn() };
jest.mock('../../core/file-storage', () => ({
	...jest.requireActual('../../core/file-storage'),
	FileStorage: class {
		getProvider() {
			return mockProvider;
		}
	}
}));

import { NotFoundException } from '@nestjs/common';
import { RequestContext } from '../../core/context';
import * as thumbnails from '../../core/file-storage/helpers/image-thumbnail';
import { ScreenshotController } from './screenshot.controller';

/**
 * `POST /timesheet/screenshot` stored the body's `timeSlotId` as sent, so an employee could file their own image under
 * a colleague's time slot, where it showed in that colleague's timesheet and activity as their screenshot. The slot is
 * now read through the time-slot service, which limits a caller without CHANGE_SELECTED_EMPLOYEE to their own slots.
 */
describe('Screenshot Controller — the time slot a screenshot is filed under', () => {
	const OWN_SLOT = '11111111-1111-4111-8111-111111111111';
	const COLLEAGUE_SLOT = '22222222-2222-4222-8222-222222222222';

	const provider = mockProvider;
	const screenshots = {
		create: jest.fn(async (entity: any) => ({ id: 'shot-1', ...entity })),
		findOneByIdString: jest.fn(async () => ({ id: 'shot-1' }))
	};
	// The service's employee scope: a colleague's slot is not found for this caller
	const timeSlots = {
		findOneByIdString: jest.fn(async (id: string) => {
			if (id !== OWN_SLOT) {
				throw new NotFoundException();
			}
			return { id };
		})
	};
	let controller: ScreenshotController;

	beforeEach(() => {
		jest.clearAllMocks();
		controller = new ScreenshotController(
			screenshots as never,
			{ publish: jest.fn() } as never,
			timeSlots as never
		);

		jest.spyOn(thumbnails, 'createImageThumbnail').mockResolvedValue({
			data: Buffer.from('thumb'),
			extension: 'png'
		} as never);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1' } as never);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
		// A 1x1 PNG
		provider.getFile.mockResolvedValue(
			Buffer.from(
				'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
				'base64'
			)
		);
		provider.putFile.mockResolvedValue({ key: 'screenshots/thumb-s.png' });
	});

	afterEach(() => jest.restoreAllMocks());

	const upload = (timeSlotId: unknown) =>
		controller.create(
			{ organizationId: 'org-1', timeSlotId } as never,
			{ key: 'screenshots/s.png', filename: 's.png' } as never
		);

	it('files the screenshot under the caller’s own slot', async () => {
		await upload(OWN_SLOT);

		expect(screenshots.create).toHaveBeenCalledWith(expect.objectContaining({ timeSlotId: OWN_SLOT }));
	});

	it('does not file it under a colleague’s slot', async () => {
		await upload(COLLEAGUE_SLOT);

		expect(timeSlots.findOneByIdString).toHaveBeenCalledWith(COLLEAGUE_SLOT);
		expect(screenshots.create).toHaveBeenCalledWith(expect.objectContaining({ timeSlotId: null }));
	});

	it('still leaves an id that is not a UUID out, without a lookup', async () => {
		await upload('not-a-slot');

		expect(timeSlots.findOneByIdString).not.toHaveBeenCalled();
		expect(screenshots.create).toHaveBeenCalledWith(expect.objectContaining({ timeSlotId: null }));
	});
});

import '../../../../core/entities/internal';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ScreenshotUpdateCommand } from '../screenshot-update.command';
import { ScreenshotUpdateHandler } from './screenshot-update.handler';

/** A missing screenshot keeps its 404 (the integration sync re-creates on it); other failures stay a 400. */
describe('ScreenshotUpdateHandler', () => {
	const run = (update: jest.Mock) =>
		new ScreenshotUpdateHandler({ update, findOneByIdString: jest.fn() } as any).execute(
			new ScreenshotUpdateCommand({ id: 'screenshot-1', file: 'full.png', thumb: 'thumb.png' } as any)
		);

	it('keeps the NotFoundException of a missing screenshot', async () => {
		await expect(run(jest.fn().mockRejectedValue(new NotFoundException()))).rejects.toBeInstanceOf(NotFoundException);
	});

	it('still answers 400 for another failure', async () => {
		await expect(run(jest.fn().mockRejectedValue(new Error('disk full')))).rejects.toBeInstanceOf(BadRequestException);
	});
});

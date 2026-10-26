import '../core/entities/internal';

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { StatusTypesEnum } from '@gauzy/contracts';
import { TimeOffRequestService } from './time-off-request.service';

/**
 * `updateStatusTimeOffByAdmin` wrapped every error in a `BadRequestException`, so an unknown id (404) and a
 * request that is no longer pending (409) both answered 400. Intentional HTTP errors now pass through
 * unchanged, as they already do in `updateTimeOffByAdmin`.
 */
describe('TimeOffRequestService.updateStatusTimeOffByAdmin', () => {
	const ID = '7a000000-0000-4000-8000-000000000001';

	/** Runs the real method against a stub of the lookup and the save. */
	const run = (stub: { findOneByIdString: jest.Mock; save?: jest.Mock }, status = StatusTypesEnum.APPROVED) =>
		TimeOffRequestService.prototype.updateStatusTimeOffByAdmin.call(
			{ save: jest.fn(async (entity: any) => entity), ...stub },
			ID,
			status
		);

	it('updates the status of a pending request', async () => {
		const stub = {
			findOneByIdString: jest.fn().mockResolvedValue({ id: ID, status: StatusTypesEnum.REQUESTED }),
			save: jest.fn(async (entity: any) => entity)
		};

		await expect(run(stub)).resolves.toEqual({ id: ID, status: StatusTypesEnum.APPROVED });
		expect(stub.save).toHaveBeenCalledTimes(1);
	});

	it('keeps the 409 for a request that is no longer pending', async () => {
		const stub = {
			findOneByIdString: jest.fn().mockResolvedValue({ id: ID, status: StatusTypesEnum.APPROVED }),
			save: jest.fn()
		};

		await expect(run(stub)).rejects.toBeInstanceOf(ConflictException);
		expect(stub.save).not.toHaveBeenCalled();
	});

	it('keeps the 404 for an unknown id', async () => {
		const stub = { findOneByIdString: jest.fn().mockRejectedValue(new NotFoundException()) };

		await expect(run(stub)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('still answers 400 for any other failure', async () => {
		const stub = {
			findOneByIdString: jest.fn().mockResolvedValue({ id: ID, status: StatusTypesEnum.REQUESTED }),
			save: jest.fn().mockRejectedValue(new Error('database down'))
		};

		await expect(run(stub)).rejects.toBeInstanceOf(BadRequestException);
	});
});

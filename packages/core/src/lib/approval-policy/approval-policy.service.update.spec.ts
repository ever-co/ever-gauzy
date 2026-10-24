import '../core/entities/internal';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApprovalPolicyService } from './approval-policy.service';

/**
 * `update` wrapped every error in a `BadRequestException`, so an unknown approval policy id answered 400
 * instead of the 404 raised by the tenant-scoped lookup. Intentional HTTP errors now pass through.
 */
describe('ApprovalPolicyService.update', () => {
	const ID = '7c000000-0000-4000-8000-000000000001';
	const input = { name: 'Business Trip', organizationId: '7c000000-0000-4000-8000-0000000000a1' } as any;

	/** Runs the real method against a stub of the lookup and the save. */
	const run = (stub: Record<string, unknown>) =>
		ApprovalPolicyService.prototype.update.call(
			{ save: jest.fn(async (entity: any) => entity), ...stub },
			ID,
			input
		);

	it('keeps the 404 for an unknown policy', async () => {
		const stub = { findOneByIdString: jest.fn().mockRejectedValue(new NotFoundException()) };

		await expect(run(stub)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('still answers 400 for any other failure', async () => {
		const stub = {
			findOneByIdString: jest.fn().mockResolvedValue({ id: ID }),
			save: jest.fn().mockRejectedValue(new Error('database down'))
		};

		await expect(run(stub)).rejects.toBeInstanceOf(BadRequestException);
	});

	it('updates the policy when it exists', async () => {
		const stub = { findOneByIdString: jest.fn().mockResolvedValue({ id: ID }) };

		await expect(run(stub)).resolves.toMatchObject({
			id: ID,
			name: 'Business Trip',
			approvalType: 'BUSINESS_TRIP'
		});
	});
});

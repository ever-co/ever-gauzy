import '../../../core/entities/internal';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApprovalPolicyUpdateCommand } from '../approval-policy.update.command';
import { ApprovalPolicyUpdateHandler } from './approval-policy.update.handler';

/**
 * The update handler wrapped every error from the service in a `BadRequestException`, so the 404 for an
 * unknown approval policy reached the client as 400. Intentional HTTP errors now pass through.
 */
describe('ApprovalPolicyUpdateHandler', () => {
	const ID = '7d000000-0000-4000-8000-000000000001';
	const command = new ApprovalPolicyUpdateCommand(ID, { name: 'Business Trip' } as any);

	const handlerWith = (update: jest.Mock) => new ApprovalPolicyUpdateHandler({ update } as any);

	it('keeps the 404 for an unknown policy', async () => {
		const handler = handlerWith(jest.fn().mockRejectedValue(new NotFoundException()));

		await expect(handler.execute(command)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('still answers 400 for any other failure', async () => {
		const handler = handlerWith(jest.fn().mockRejectedValue(new Error('database down')));

		await expect(handler.execute(command)).rejects.toBeInstanceOf(BadRequestException);
	});

	it('returns the updated policy', async () => {
		const policy = { id: ID, name: 'Business Trip' };
		const handler = handlerWith(jest.fn().mockResolvedValue(policy));

		await expect(handler.execute(command)).resolves.toBe(policy);
	});
});

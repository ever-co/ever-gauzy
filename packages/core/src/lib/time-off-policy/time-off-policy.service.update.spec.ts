import '../core/entities/internal';

import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { MultiORMEnum } from '../core/utils';
import { TimeOffPolicyService } from './time-off-policy.service';

/**
 * `update` wrapped every error in a 400, so a policy id that does not exist (or belongs to another tenant or
 * organization) answered 400 instead of the 404 raised by the lookup. Intentional HTTP errors now pass through.
 */
describe('TimeOffPolicyService.update', () => {
	const ID = '7b000000-0000-4000-8000-000000000001';
	const TENANT_ID = '7b000000-0000-4000-8000-00000000000a';
	const ORGANIZATION_ID = '7b000000-0000-4000-8000-0000000000a1';

	const input = { name: 'Vacation', organizationId: ORGANIZATION_ID, tenantId: TENANT_ID, employees: [] } as any;

	/** Runs the real method against a stub of the lookup, the employee repository and the save. */
	const run = (stub: Record<string, unknown>) =>
		TimeOffPolicyService.prototype.update.call(
			{
				ormType: MultiORMEnum.TypeORM,
				typeOrmEmployeeRepository: { find: jest.fn().mockResolvedValue([]) },
				save: jest.fn(async (entity: any) => entity),
				...stub
			},
			ID,
			input
		);

	it('keeps the 404 for an unknown policy', async () => {
		const stub = { findOneByWhereOptions: jest.fn().mockRejectedValue(new NotFoundException()) };

		await expect(run(stub)).rejects.toBeInstanceOf(NotFoundException);
	});

	it('still answers 400 for any other failure', async () => {
		const stub = {
			findOneByWhereOptions: jest.fn().mockResolvedValue({ id: ID }),
			save: jest.fn().mockRejectedValue(new Error('database down'))
		};

		const error = await run(stub).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(HttpException);
		expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
	});

	it('updates the policy when it exists', async () => {
		const stub = { findOneByWhereOptions: jest.fn().mockResolvedValue({ id: ID }) };

		await expect(run(stub)).resolves.toMatchObject({ id: ID, name: 'Vacation' });
	});
});

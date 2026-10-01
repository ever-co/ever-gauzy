import '../core/entities/internal';

import { SOFT_DELETABLE_FILTER } from 'mikro-orm-soft-delete';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { EmployeeService } from './employee.service';
import { asTenantUser, createCrossTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';

/**
 * The employees page has an "Include deleted" toggle, sent as `withDeleted`. The TypeORM branch of
 * `EmployeeService.pagination` forwards it; the MikroORM branch has to turn off the soft-delete filter.
 */
describe('EmployeeService.pagination withDeleted (MikroORM)', () => {
	const { tenantA } = createCrossTenantFixture();

	let restore: () => void;
	let findAndCount: jest.Mock;
	let service: EmployeeService;

	const paginate = (withDeleted?: boolean) =>
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service.pagination({ where: { organizationId: tenantA.organizationId }, withDeleted, take: 10, skip: 1 } as any);

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		findAndCount = jest.fn().mockResolvedValue([[], 0]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service = new EmployeeService({ metadata: { tableName: 'employee' } } as any, { findAndCount } as any);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('turns off the soft-delete filter when deleted employees are requested', async () => {
		await paginate(true);
		expect(findAndCount).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ filters: { [SOFT_DELETABLE_FILTER]: false } })
		);
	});

	it.each([false, undefined])('keeps the soft-delete filter otherwise (%p)', async (withDeleted) => {
		await paginate(withDeleted);
		expect(findAndCount.mock.calls[0][1]).not.toHaveProperty('filters');
	});
});

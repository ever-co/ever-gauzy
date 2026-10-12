import '../core/entities/internal';

import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { CandidateService } from '../candidate/candidate.service';
import { EmployeeService } from '../employee/employee.service';
import { asTenantUser, createCrossTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';

/**
 * Name / email searches split the input into keywords and OR a LIKE per keyword. An empty keyword
 * (trailing or repeated space) used to become `LIKE '%%'` and match every row. These pin the MikroORM
 * branches of the employee and candidate paginations; the time off one is covered by its own spec.
 */
describe('Name / email search keywords (MikroORM)', () => {
	const { tenantA } = createCrossTenantFixture();
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const typeOrmRepository = { metadata: { tableName: 'stub' } } as any;

	let restore: () => void;
	let findAndCount: jest.Mock;

	const where = (user: Record<string, string>) => ({ where: { organizationId: tenantA.organizationId, user } });
	const filter = () => findAndCount.mock.calls[0][0];

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		findAndCount = jest.fn().mockResolvedValue([[], 0]);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	describe('EmployeeService.pagination', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const service = () => new EmployeeService(typeOrmRepository, { findAndCount } as any);

		it('ignores a trailing space in the name', async () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await service().pagination(where({ name: 'Ada ' }) as any);
			expect(filter().$or).toHaveLength(2); // first name + last name for "Ada" only
		});

		it.each([
			['name', { name: '   ' }],
			['email', { email: '   ' }]
		])('adds no condition for a whitespace-only %s', async (_label, user) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await service().pagination(where(user) as any);
			expect(filter()).not.toHaveProperty('$or');
		});
	});

	describe('CandidateService.pagination', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const service = () => new CandidateService(typeOrmRepository, { findAndCount } as any);

		it('ignores repeated spaces in the name', async () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await service().pagination(where({ name: 'Ada   Love' }) as any);
			expect(filter().$or).toHaveLength(4); // first + last name for "Ada" and "Love"
		});

		it('adds no condition for a whitespace-only name', async () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await service().pagination(where({ name: '   ' }) as any);
			expect(filter()).not.toHaveProperty('$or');
		});
	});
});

import '../core/entities/internal';

import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { EmployeeService } from './employee.service';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';

/**
 * `EmployeeService.pagination` derived the offset as `take * (skip - 1)` before defaulting `take`,
 * so a page number sent without a page size produced a NaN offset on both ORMs.
 */
describe('EmployeeService.pagination default page size', () => {
	const tenant = createTenantFixture();
	const typeOrmRepositoryMetadata = { metadata: { tableName: 'employee' } };

	let restore: () => void;

	const paginate = (service: EmployeeService, page: { take?: number; skip?: number }) =>
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service.pagination({ where: { organizationId: tenant.organizationId }, ...page } as any);

	beforeEach(() => {
		({ restore } = asTenantUser(tenant));
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	describe('TypeORM', () => {
		let query: Record<string, unknown> & { setFindOptions: jest.Mock };
		let service: EmployeeService;

		beforeEach(() => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			query = {
				alias: 'employee',
				leftJoin: jest.fn(),
				setFindOptions: jest.fn(),
				where: jest.fn(),
				getManyAndCount: jest.fn().mockResolvedValue([[], 0])
			};
			const typeOrmRepository = { ...typeOrmRepositoryMetadata, createQueryBuilder: jest.fn().mockReturnValue(query) };
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			service = new EmployeeService(typeOrmRepository as any, {} as any);
		});

		it('defaults the page size when only `skip` is sent', async () => {
			await paginate(service, { skip: 3 });
			expect(query.setFindOptions).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
		});

		it('keeps the requested page size and offset when `take` is sent', async () => {
			await paginate(service, { take: 25, skip: 3 });
			expect(query.setFindOptions).toHaveBeenCalledWith(expect.objectContaining({ skip: 50, take: 25 }));
		});

		it('starts at the first row when no page is sent', async () => {
			await paginate(service, {});
			expect(query.setFindOptions).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }));
		});
	});

	describe('MikroORM', () => {
		let findAndCount: jest.Mock;
		let service: EmployeeService;

		beforeEach(() => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
			findAndCount = jest.fn().mockResolvedValue([[], 0]);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			service = new EmployeeService(typeOrmRepositoryMetadata as any, { findAndCount } as any);
		});

		it('defaults the page size when only `skip` is sent', async () => {
			await paginate(service, { skip: 3 });
			expect(findAndCount).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ offset: 20, limit: 10 })
			);
		});

		it('keeps the requested page size and offset when `take` is sent', async () => {
			await paginate(service, { take: 25, skip: 3 });
			expect(findAndCount).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ offset: 50, limit: 25 })
			);
		});
	});
});

import '../core/entities/internal';

import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { TimeOffRequestService } from './time-off-request.service';
import { asTenantUser, createCrossTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';

/**
 * The time off page has an "Include Archived" checkbox. Unchecked it hides archived requests; checked it
 * must show them alongside the active ones. It used to filter on `isArchived = true`, showing only archived.
 */
describe('TimeOffRequestService.pagination "Include Archived"', () => {
	const { tenantA } = createCrossTenantFixture();
	const typeOrmRepositoryMetadata = { metadata: { tableName: 'time_off_request' } };

	let restore: () => void;

	const where = (includeArchived: unknown) => ({ organizationId: tenantA.organizationId, includeArchived });

	// The query DTO JSON-parses `where` values, so the service normally receives booleans; strings are
	// covered too for direct callers.
	const unchecked = [false, 'false'];
	const checked = [true, 'true'];

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	describe('TypeORM', () => {
		let qb: { alias: string; andWhere: jest.Mock };
		let service: TimeOffRequestService;

		beforeEach(() => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			qb = { alias: 'time_off_request', andWhere: jest.fn() };
			const query = {
				alias: 'time_off_request',
				setFindOptions: jest.fn(),
				leftJoin: jest.fn(),
				// Run the WHERE callback against a recording query builder
				where: jest.fn((callback: (builder: typeof qb) => void) => callback(qb)),
				getManyAndCount: jest.fn().mockResolvedValue([[], 0])
			};
			service = new TimeOffRequestService(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				{ ...typeOrmRepositoryMetadata, createQueryBuilder: jest.fn().mockReturnValue(query) } as any,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				{} as any,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				{} as any
			);
		});

		it.each(unchecked)('hides archived requests when unchecked (%p)', async (value) => {
			await service.pagination({ where: where(value) });
			expect(qb.andWhere).toHaveBeenCalledWith({ isArchived: false });
		});

		it.each([...checked, undefined])('adds no archived filter when checked or not sent (%p)', async (value) => {
			await service.pagination({ where: where(value) });
			expect(qb.andWhere).not.toHaveBeenCalledWith({ isArchived: false });
			expect(qb.andWhere).not.toHaveBeenCalledWith({ isArchived: true });
		});
	});

	describe('MikroORM', () => {
		let findAndCount: jest.Mock;
		let service: TimeOffRequestService;

		beforeEach(() => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
			findAndCount = jest.fn().mockResolvedValue([[], 0]);
			service = new TimeOffRequestService(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				typeOrmRepositoryMetadata as any,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				{ findAndCount } as any,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				{} as any
			);
		});

		it.each(unchecked)('hides archived requests when unchecked (%p)', async (value) => {
			await service.pagination({ where: where(value) });
			expect(findAndCount.mock.calls[0][0].isArchived).toBe(false);
		});

		it.each([...checked, undefined])('adds no archived filter when checked or not sent (%p)', async (value) => {
			await service.pagination({ where: where(value) });
			expect(findAndCount.mock.calls[0][0]).not.toHaveProperty('isArchived');
		});
	});
});

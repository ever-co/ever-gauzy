import '../core/entities/internal';

import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { TimeOffRequestService } from './time-off-request.service';
import { asTenantUser, createCrossTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';

/**
 * The time off table filters by employee name, description and policy name. The MikroORM branch of
 * `TimeOffRequestService.pagination` used to read those from the query it was building instead of the
 * client filter, so it never applied them.
 */
describe('TimeOffRequestService.pagination MikroORM text filters', () => {
	const { tenantA } = createCrossTenantFixture();

	let restore: () => void;
	let findAndCount: jest.Mock;
	let service: TimeOffRequestService;

	const paginate = (where: Record<string, unknown>) =>
		service.pagination({ where: { organizationId: tenantA.organizationId, ...where }, take: 10, skip: 1 });

	const lastWhere = () => findAndCount.mock.calls[0][0];

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		findAndCount = jest.fn().mockResolvedValue([[], 0]);
		service = new TimeOffRequestService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'time_off_request' } } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ findAndCount } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any
		);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('filters by description', async () => {
		await paginate({ description: 'vacation' });
		expect(lastWhere().description).toEqual({ $ilike: '%vacation%' });
	});

	it('filters by policy name', async () => {
		await paginate({ policy: { name: 'Sick' } });
		expect(lastWhere().policy).toEqual({ name: { $ilike: '%Sick%' } });
	});

	it('filters by employee name keywords, combined with the date range', async () => {
		await paginate({
			user: { name: 'Ada Love' },
			startDate: '2026-09-01 00:00:00',
			endDate: '2026-09-30 23:59:59'
		});
		const where = lastWhere();
		expect(where.$or).toBeUndefined();
		expect(where.$and).toHaveLength(2);
		// First half: the time off overlaps the requested window (start or end inside it)
		expect(where.$and[0].$or).toEqual([
			{ start: { $gte: '2026-09-01 00:00:00', $lte: '2026-09-30 23:59:59' } },
			{ end: { $gte: '2026-09-01 00:00:00', $lte: '2026-09-30 23:59:59' } }
		]);
		// Second half: any keyword matches the employee's first or last name
		expect(where.$and[1].$or).toEqual([
			{ employees: { user: { firstName: { $ilike: '%Ada%' } } } },
			{ employees: { user: { lastName: { $ilike: '%Ada%' } } } },
			{ employees: { user: { firstName: { $ilike: '%Love%' } } } },
			{ employees: { user: { lastName: { $ilike: '%Love%' } } } }
		]);
	});

	it('adds no text filter when none is requested', async () => {
		await paginate({});
		const where = lastWhere();
		expect(where.description).toBeUndefined();
		expect(where.policy).toBeUndefined();
		expect(where.$and).toBeUndefined();
	});
});

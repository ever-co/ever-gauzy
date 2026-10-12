import '../core/entities/internal';

import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimeOffRequestService } from './time-off-request.service';

/**
 * `GET /time-off-request` (the appointment calendar and the availability slots) takes optional dates. Without
 * them, the window used to collapse to "now" and listed nothing; with them, the 12-hour `hh` format moved an
 * afternoon bound 12 hours back.
 */
describe('TimeOffRequestService.getAllTimeOffRequests date window', () => {
	const fixture = createTenantFixture();
	const range = { startDate: new Date('2026-10-01T00:00:00.000Z'), endDate: new Date('2026-10-31T23:59:59.000Z') };

	let restore: () => void;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		jest
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.spyOn(TimeOffRequestService.prototype as any, 'serialize')
			.mockImplementation((entity: object) => ({ ...entity }));
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	describe('MikroORM', () => {
		let find: jest.Mock;
		let service: TimeOffRequestService;

		beforeEach(() => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
			find = jest.fn().mockResolvedValue([]);
			service = new TimeOffRequestService(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				{ metadata: { tableName: 'time_off_request' } } as any,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				{ find } as any,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				{} as any
			);
		});

		it('lists every time off of the organization when no dates are given', async () => {
			await service.getAllTimeOffRequests([], { organizationId: fixture.organizationId });

			expect(find.mock.calls[0][0]).toEqual({
				tenantId: fixture.tenantId,
				organizationId: fixture.organizationId
			});
		});

		it('bounds the window with the given dates on the 24-hour clock', async () => {
			await service.getAllTimeOffRequests([], { organizationId: fixture.organizationId, ...range });

			expect(find.mock.calls[0][0].start).toEqual({ $gte: '2026-10-01 00:00:00', $lte: '2026-10-31 23:59:59' });
		});
	});

	describe('TypeORM', () => {
		let conditions: [string, Record<string, unknown>?][];
		let service: TimeOffRequestService;

		beforeEach(() => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			conditions = [];
			const query: Record<string, unknown> = { alias: 'timeoff' };
			for (const method of ['leftJoinAndSelect', 'innerJoin']) {
				query[method] = jest.fn(() => query);
			}
			query.andWhere = jest.fn((condition: string | object, parameters?: Record<string, unknown>) => {
				// Brackets (tenant / organization) are not strings: only the raw conditions are recorded
				if (typeof condition === 'string') conditions.push([condition, parameters]);
				return query;
			});
			query.getMany = jest.fn().mockResolvedValue([]);
			service = new TimeOffRequestService(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				{ metadata: { tableName: 'time_off_request' }, createQueryBuilder: () => query } as any,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				{} as any,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				{} as any
			);
		});

		it('adds no BETWEEN when no dates are given', async () => {
			await service.getAllTimeOffRequests([], { organizationId: fixture.organizationId });

			expect(conditions.some(([condition]) => condition.includes('BETWEEN'))).toBe(false);
		});

		it('bounds the window with the given dates on the 24-hour clock', async () => {
			await service.getAllTimeOffRequests([], { organizationId: fixture.organizationId, ...range });

			const between = conditions.find(([condition]) => condition.includes('BETWEEN'));
			expect(between?.[1]).toEqual({ begin: '2026-10-01 00:00:00', end: '2026-10-31 23:59:59' });
		});
	});
});

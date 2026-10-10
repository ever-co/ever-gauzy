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
describe('TimeOffRequestService.getAllTimeOffRequests date window (MikroORM)', () => {
	const fixture = createTenantFixture();

	let restore: () => void;
	let find: jest.Mock;
	let service: TimeOffRequestService;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		jest
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.spyOn(TimeOffRequestService.prototype as any, 'serialize')
			.mockImplementation((entity: object) => ({ ...entity }));
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

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('lists every time off of the organization when no dates are given', async () => {
		await service.getAllTimeOffRequests([], { organizationId: fixture.organizationId });

		expect(find.mock.calls[0][0]).toEqual({ tenantId: fixture.tenantId, organizationId: fixture.organizationId });
	});

	it('bounds the window with the given dates on the 24-hour clock', async () => {
		await service.getAllTimeOffRequests([], {
			organizationId: fixture.organizationId,
			startDate: new Date('2026-10-01T00:00:00.000Z'),
			endDate: new Date('2026-10-31T23:59:59.000Z')
		});

		expect(find.mock.calls[0][0].start).toEqual({ $gte: '2026-10-01 00:00:00', $lte: '2026-10-31 23:59:59' });
	});
});

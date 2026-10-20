import '../../core/entities/internal';

import { RequestContext } from '../../core/context';
import { CrudService } from '../../core/crud/crud.service';
import { MultiORMEnum } from '../../core/utils';
import { ActivityService } from './activity.service';

/**
 * The MikroORM activity list ignored the requested period: a one-day request listed the activities of every
 * day. It now filters `recordedAt` between the bounds, as the TypeORM branch does.
 */
describe('ActivityService.getActivities (MikroORM) date range', () => {
	const list = async (request: Record<string, unknown>) => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
		const find = jest.fn().mockResolvedValue([]);
		const service = new ActivityService(
			{ metadata: { tableName: 'activity' } } as any,
			{ find } as any,
			{} as any,
			{} as any,
			{} as any
		);
		await service.getActivities({ organizationId: 'org-1', ...request } as any);
		return find.mock.calls[0][0];
	};

	afterEach(() => jest.restoreAllMocks());

	it('lists the activities recorded within the requested period', async () => {
		const where = await list({ startDate: '2026-10-19 00:00:00', endDate: '2026-10-19 23:59:59' });

		expect(where.recordedAt).toEqual({ $gte: '2026-10-19 00:00:00', $lte: '2026-10-19 23:59:59' });
	});

	it('adds no date filter without both bounds', async () => {
		expect((await list({ startDate: '2026-10-19 00:00:00' })).recordedAt).toBeUndefined();
	});
});

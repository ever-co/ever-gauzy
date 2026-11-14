// Must stay first: loads the entity graph before the service pulls an entity (see activity.controller.spec.ts).
import '../core/entities/internal';

import { Not } from 'typeorm';
import { BaseEntityEnum } from '@gauzy/contracts';
import { ActivityLogService } from './activity-log.service';

/**
 * `GET /activity-log` (and its GraphQL field) checks no permission beyond the organization's membership. A time
 * entry's history (ever-co/ever-gauzy#11922) is read through the time log routes, which apply the time scoping, so
 * this read never answers TimeLog rows. Every other entity's rows are read as before.
 */
describe('ActivityLogService.findActivityLogs and time entry history', () => {
	function setup() {
		const service = new ActivityLogService(
			{ metadata: { tableName: 'activity_log' } } as never,
			{} as never,
			{ publish: jest.fn() } as never
		);
		const findAll = jest
			.spyOn(Object.getPrototypeOf(ActivityLogService.prototype), 'findAll')
			.mockResolvedValue({ items: [{ id: 'row-1' }], total: 1 } as never);
		return { service, findAll };
	}

	afterEach(() => jest.restoreAllMocks());

	it('answers no row, without reading, for entity=TimeLog', async () => {
		const { service, findAll } = setup();

		const answer = await service.findActivityLogs({
			organizationId: 'org-1',
			entity: BaseEntityEnum.TimeLog
		} as never);

		expect(answer).toEqual({ items: [], total: 0 });
		expect(findAll).not.toHaveBeenCalled();
	});

	it('leaves TimeLog rows out of a read that names no entity', async () => {
		const { service, findAll } = setup();

		await service.findActivityLogs({ organizationId: 'org-1' } as never);

		const [{ where }] = findAll.mock.calls[0] as [{ where: Record<string, unknown> }];
		expect(where.entity).toEqual(Not(BaseEntityEnum.TimeLog));
	});

	it('reads the rows of another entity as before', async () => {
		const { service, findAll } = setup();

		const answer = await service.findActivityLogs({
			organizationId: 'org-1',
			entity: BaseEntityEnum.Task,
			entityId: 'task-1'
		} as never);

		const [{ where }] = findAll.mock.calls[0] as [{ where: Record<string, unknown> }];
		expect(where).toMatchObject({ organizationId: 'org-1', entity: BaseEntityEnum.Task, entityId: 'task-1' });
		expect(answer).toEqual({ items: [{ id: 'row-1' }], total: 1 });
	});
});

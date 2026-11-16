// Must stay first: loads the entity graph before the service pulls an entity (see activity.controller.spec.ts).
import '../../core/entities/internal';

import { RequestContext } from '../../core/context';
import { ActivityLog } from '../../activity-log/activity-log.entity';
import { PROJECT_ID_OF_ROW } from '../../organization-project/hidden-projects';
import { TimeLog } from './time-log.entity';
import { TimeLogHistoryService } from './time-log-history.service';

/**
 * CORE-27 (ever-co/ever-gauzy#12031): a history row quotes the name its entry's project had when the row was written,
 * so the history read keeps beside each row the project its entry is on now, withdrawn entries included, for the
 * answer to withhold a project the caller may not see whatever its name was then.
 */
describe('TimeLogHistoryService and hidden projects', () => {
	afterEach(() => jest.restoreAllMocks());

	it("keeps beside each row of an entry's history the project the entry is on now", async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		const rows = [{ id: 'history-1', entityId: 'log-1', data: { employeeId: 'employee-paul' } }];
		const manager = {
			findOne: jest.fn(async () => ({ id: 'log-1', employeeId: 'employee-paul' })),
			find: jest.fn(async (entity: unknown) => {
				if (entity === ActivityLog) {
					return rows;
				}
				return [{ id: 'log-1', projectId: 'project-client-x-redesign' }];
			})
		};
		const service = new TimeLogHistoryService(
			{ manager } as never,
			{ assertCanReadEmployeeTimeLogs: jest.fn() } as never,
			{} as never
		);

		const history = await service.findEntryHistory('log-1', 'org-1');

		expect((history[0] as unknown as Record<symbol, unknown>)[PROJECT_ID_OF_ROW]).toBe('project-client-x-redesign');
		expect(manager.find).toHaveBeenCalledWith(TimeLog, {
			where: { id: expect.anything(), tenantId: 'tenant-1' },
			select: { id: true, projectId: true },
			withDeleted: true
		});
		expect(JSON.parse(JSON.stringify(history))).toEqual(rows);
	});
});

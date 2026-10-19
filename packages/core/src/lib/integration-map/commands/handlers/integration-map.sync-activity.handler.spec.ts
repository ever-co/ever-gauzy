import '../../../core/entities/internal';

import { IntegrationEntity } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { ActivityCreateCommand, ActivityUpdateCommand } from '../../../time-tracking/activity/commands';
import { IntegrationMapSyncEntityCommand } from '../integration-map.sync-entity.command';
import { IntegrationMapSyncActivityCommand } from '../integration-map.sync-activity.command';
import { IntegrationMapSyncActivityHandler } from './integration-map.sync-activity.handler';

/**
 * The map lookup and the activity update shared one try: a failed update was read as "not mapped yet", so the
 * activity got a second record and a second integration map for the same source id.
 */
describe('IntegrationMapSyncActivityHandler', () => {
	const activity = () => ({ title: 'Code', duration: 60, employeeId: 'employee-1', organizationId: 'org-1' });
	const command = (entity = activity()) =>
		new IntegrationMapSyncActivityCommand({
			entity: entity as never,
			sourceId: '42',
			integrationId: 'integration-1',
			organizationId: 'org-1'
		});
	const setup = (integrationMapService: object) => {
		const execute = jest.fn();
		const handler = new IntegrationMapSyncActivityHandler({ execute } as never, integrationMapService as never);
		return { execute, handler };
	};

	beforeEach(() => jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1'));
	afterEach(() => jest.restoreAllMocks());

	it('rejects when the update of the mapped activity fails, creating nothing', async () => {
		const integrationMap = { id: 'map-1', gauzyId: 'activity-1' };
		const { execute, handler } = setup({ findOneByWhereOptions: jest.fn().mockResolvedValue(integrationMap) });
		execute.mockRejectedValue(new Error('update failed'));

		await expect(handler.execute(command())).rejects.toThrow('update failed');

		expect(execute).toHaveBeenCalledTimes(1);
		expect(execute.mock.calls[0][0]).toBeInstanceOf(ActivityUpdateCommand);
	});

	it('updates a copy of the entity with the mapped id and returns the map', async () => {
		const integrationMap = { id: 'map-1', gauzyId: 'activity-1' };
		const { execute, handler } = setup({ findOneByWhereOptions: jest.fn().mockResolvedValue(integrationMap) });
		execute.mockResolvedValue({ id: 'activity-1' });
		const entity = activity();

		expect(await handler.execute(command(entity))).toBe(integrationMap);

		const [[update]] = execute.mock.calls;
		expect(update.input).toEqual({ ...activity(), id: 'activity-1' });
		expect(entity).not.toHaveProperty('id');
	});

	it('creates the activity and its map once when it is not mapped yet', async () => {
		const { execute, handler } = setup({
			findOneByWhereOptions: jest.fn().mockRejectedValue(new Error('not found'))
		});
		execute.mockResolvedValueOnce({ id: 'activity-new' }).mockResolvedValueOnce({ id: 'map-new' });

		expect(await handler.execute(command())).toEqual({ id: 'map-new' });

		expect(execute).toHaveBeenCalledTimes(2);
		const [[create], [map]] = execute.mock.calls;
		expect(create).toBeInstanceOf(ActivityCreateCommand);
		expect(create.input).toEqual(activity());
		expect(map).toBeInstanceOf(IntegrationMapSyncEntityCommand);
		expect(map.input).toMatchObject({
			gauzyId: 'activity-new',
			entity: IntegrationEntity.ACTIVITY,
			sourceId: '42',
			integrationId: 'integration-1',
			organizationId: 'org-1',
			tenantId: 'tenant-1'
		});
	});
});

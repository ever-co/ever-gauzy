import '../../../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { IntegrationEntity } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { TaskCreateCommand, TaskUpdateCommand } from '../../../tasks/commands';
import { IntegrationMapSyncEntityCommand } from '../integration-map.sync-entity.command';
import { IntegrationMapSyncIssueCommand } from '../integration-map.sync-issue.command';
import { IntegrationMapSyncIssueHandler } from './integration-map.sync-issue.handler';

/**
 * The map lookup and the task update shared one try: a failed update was read as "not mapped yet", so the
 * issue got a second task and a second integration map for the same source id.
 */
describe('IntegrationMapSyncIssueHandler', () => {
	const entity = { title: 'Synced issue', organizationId: 'org-1' };
	const command = () =>
		new IntegrationMapSyncIssueCommand({
			entity: entity as never,
			sourceId: '42',
			integrationId: 'integration-1',
			organizationId: 'org-1'
		});
	const setup = (integrationMapService: object, taskService: object = { findOneByIdString: jest.fn() }) => {
		const execute = jest.fn();
		const handler = new IntegrationMapSyncIssueHandler(
			{ execute } as never,
			integrationMapService as never,
			taskService as never
		);
		return { execute, handler };
	};

	beforeEach(() => jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1'));
	afterEach(() => jest.restoreAllMocks());

	it('rejects when the update of the mapped task fails, creating nothing', async () => {
		const integrationMap = { id: 'map-1', gauzyId: 'task-1' };
		const integrationMapService = { findOneByWhereOptions: jest.fn().mockResolvedValue(integrationMap) };
		const taskService = { findOneByIdString: jest.fn().mockResolvedValue({ id: 'task-1' }) };
		const { execute, handler } = setup(integrationMapService, taskService);
		execute.mockRejectedValue(new Error('update failed'));

		await expect(handler.execute(command())).rejects.toThrow('update failed');

		expect(execute).toHaveBeenCalledTimes(1);
		const [[update]] = execute.mock.calls;
		expect(update).toBeInstanceOf(TaskUpdateCommand);
		expect(update.id).toBe('task-1');
	});

	it('updates the mapped task and returns the existing map', async () => {
		const integrationMap = { id: 'map-1', gauzyId: 'task-1' };
		const integrationMapService = { findOneByWhereOptions: jest.fn().mockResolvedValue(integrationMap) };
		const taskService = { findOneByIdString: jest.fn().mockResolvedValue({ id: 'task-1' }) };
		const { execute, handler } = setup(integrationMapService, taskService);
		execute.mockResolvedValue({ id: 'task-1' });

		expect(await handler.execute(command())).toBe(integrationMap);
		expect(execute).toHaveBeenCalledTimes(1);
		expect(execute.mock.calls[0][0]).toBeInstanceOf(TaskUpdateCommand);
	});

	it('creates the task and its map once when the issue is not mapped yet', async () => {
		const integrationMapService = { findOneByWhereOptions: jest.fn().mockRejectedValue(new NotFoundException('The requested record was not found')) };
		const { execute, handler } = setup(integrationMapService);
		execute.mockResolvedValueOnce({ id: 'task-new' }).mockResolvedValueOnce({ id: 'map-new' });

		expect(await handler.execute(command())).toEqual({ id: 'map-new' });

		expect(execute).toHaveBeenCalledTimes(2);
		const [[create], [map]] = execute.mock.calls;
		expect(create).toBeInstanceOf(TaskCreateCommand);
		expect(create.input).toBe(entity);
		expect(map).toBeInstanceOf(IntegrationMapSyncEntityCommand);
		expect(map.input).toMatchObject({
			gauzyId: 'task-new',
			entity: IntegrationEntity.ISSUE,
			sourceId: '42',
			integrationId: 'integration-1',
			organizationId: 'org-1',
			tenantId: 'tenant-1'
		});
	});

	it('re-creates the task under the mapped id when the mapped task no longer exists', async () => {
		const integrationMap = { id: 'map-1', gauzyId: 'task-1' };
		const integrationMapService = { findOneByWhereOptions: jest.fn().mockResolvedValue(integrationMap) };
		const taskService = { findOneByIdString: jest.fn().mockRejectedValue(new NotFoundException('The requested record was not found')) };
		const { execute, handler } = setup(integrationMapService, taskService);
		execute.mockResolvedValue({ id: 'task-1' });

		expect(await handler.execute(command())).toBe(integrationMap);

		expect(execute).toHaveBeenCalledTimes(1);
		const [[create]] = execute.mock.calls;
		expect(create).toBeInstanceOf(TaskCreateCommand);
		expect(create.input).toEqual({ ...entity, id: 'task-1' });
		expect(entity).not.toHaveProperty('id');
	});
});

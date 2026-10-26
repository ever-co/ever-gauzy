import '../../../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { IntegrationEntity } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { OrganizationCreateCommand, OrganizationUpdateCommand } from '../../../organization/commands';
import { OrganizationProjectCreateCommand, OrganizationProjectUpdateCommand } from '../../../organization-project/commands';
import { ScreenshotCreateCommand, ScreenshotUpdateCommand } from '../../../time-tracking/screenshot/commands';
import { IntegrationMapSyncEntityCommand } from '../integration-map.sync-entity.command';
import { IntegrationMapSyncOrganizationCommand } from '../integration-map.sync-organization.command';
import { IntegrationMapSyncProjectCommand } from '../integration-map.sync-project.command';
import { IntegrationMapSyncScreenshotCommand } from '../integration-map.sync-screenshot.command';
import { IntegrationMapSyncOrganizationHandler } from './integration-map.sync-organization.handler';
import { IntegrationMapSyncProjectHandler } from './integration-map.sync-project.handler';
import { IntegrationMapSyncScreenshotHandler } from './integration-map.sync-screenshot.handler';

/**
 * The project, organization and screenshot syncs: a failed update no longer creates a second entity and map,
 * while a mapped entity deleted here is still re-created, with the EXISTING map pointed at it.
 */
const cases = [
	{
		name: 'project',
		Handler: IntegrationMapSyncProjectHandler,
		command: () => new IntegrationMapSyncProjectCommand({ ...base(), entity: { name: 'Project' } } as any),
		Update: OrganizationProjectUpdateCommand,
		Create: OrganizationProjectCreateCommand,
		entity: IntegrationEntity.PROJECT
	},
	{
		name: 'organization',
		Handler: IntegrationMapSyncOrganizationHandler,
		command: () => new IntegrationMapSyncOrganizationCommand({ ...base(), entity: { name: 'Organization' } } as any),
		Update: OrganizationUpdateCommand,
		Create: OrganizationCreateCommand,
		entity: IntegrationEntity.ORGANIZATION
	},
	{
		name: 'screenshot',
		Handler: IntegrationMapSyncScreenshotHandler,
		command: () =>
			new IntegrationMapSyncScreenshotCommand({
				...base(),
				entity: { full_url: 'full.png', thumb_url: 'thumb.png', time_slot: '2026-10-19 10:00:00', employeeId: 'employee-1' }
			} as any),
		Update: ScreenshotUpdateCommand,
		Create: ScreenshotCreateCommand,
		entity: IntegrationEntity.SCREENSHOT
	}
];

function base() {
	return { integrationId: 'integration-1', sourceId: '42', organizationId: 'org-1' };
}

describe.each(cases)('IntegrationMapSync $name handler', ({ Handler, command, Update, Create, entity }) => {
	const existingMap = { id: 'map-1', gauzyId: 'gauzy-1' };

	const setup = (findMap: jest.Mock) => {
		const execute = jest.fn();
		const handler = new (Handler as any)({ execute }, { findOneByWhereOptions: findMap });
		return { execute, handler };
	};

	beforeEach(() => jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1'));
	afterEach(() => jest.restoreAllMocks());

	it('updates the mapped entity and returns the existing map', async () => {
		const { execute, handler } = setup(jest.fn().mockResolvedValue(existingMap));
		execute.mockResolvedValue({ id: 'gauzy-1' });

		expect(await handler.execute(command())).toBe(existingMap);
		expect(execute).toHaveBeenCalledTimes(1);
		expect(execute.mock.calls[0][0]).toBeInstanceOf(Update);
	});

	it('rejects when the update fails for another reason, creating nothing', async () => {
		const { execute, handler } = setup(jest.fn().mockResolvedValue(existingMap));
		execute.mockRejectedValue(new Error('update failed'));

		await expect(handler.execute(command())).rejects.toThrow('update failed');
		expect(execute).toHaveBeenCalledTimes(1);
	});

	it('re-creates a mapped entity deleted here and points the existing map at it', async () => {
		const { execute, handler } = setup(jest.fn().mockResolvedValue(existingMap));
		execute
			.mockRejectedValueOnce(new NotFoundException('The requested record was not found'))
			.mockResolvedValueOnce({ id: 'gauzy-new' })
			.mockResolvedValueOnce({ id: 'map-1', gauzyId: 'gauzy-new' });

		expect(await handler.execute(command())).toEqual({ id: 'map-1', gauzyId: 'gauzy-new' });

		const [[update], [create], [map]] = execute.mock.calls;
		expect(update).toBeInstanceOf(Update);
		expect(create).toBeInstanceOf(Create);
		expect(map).toBeInstanceOf(IntegrationMapSyncEntityCommand);
		expect(map.input).toMatchObject({ id: 'map-1', gauzyId: 'gauzy-new', sourceId: '42', entity });
	});

	it('creates the entity and a map when it is not mapped yet', async () => {
		const { execute, handler } = setup(jest.fn().mockRejectedValue(new NotFoundException('The requested record was not found')));
		execute.mockResolvedValueOnce({ id: 'gauzy-new' }).mockResolvedValueOnce({ id: 'map-new' });

		expect(await handler.execute(command())).toEqual({ id: 'map-new' });

		const [[create], [map]] = execute.mock.calls;
		expect(create).toBeInstanceOf(Create);
		expect(map.input).not.toHaveProperty('id');
		expect(map.input).toMatchObject({ gauzyId: 'gauzy-new', sourceId: '42', entity });
	});

	it('rejects when the map lookup itself fails, creating nothing', async () => {
		const { execute, handler } = setup(jest.fn().mockRejectedValue(new Error('connection lost')));

		await expect(handler.execute(command())).rejects.toThrow('connection lost');
		expect(execute).not.toHaveBeenCalled();
	});
});

import '../../../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { IntegrationEntity } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { TagCreateCommand, TagUpdateCommand } from '../../../tags/commands';
import { IntegrationMapSyncEntityCommand } from '../integration-map.sync-entity.command';
import { IntegrationMapSyncLabelCommand } from '../integration-map.sync-label.command';
import { IntegrationMapSyncLabelHandler } from './integration-map.sync-label.handler';

/**
 * The map lookup and the tag update shared one try: a failed update was read as "not mapped yet", so the
 * label got a second tag and a second integration map for the same source id.
 */
describe('IntegrationMapSyncLabelHandler', () => {
	const entity = { name: 'bug', color: '#ff0000', description: 'Bug', isSystem: false };
	const command = () =>
		new IntegrationMapSyncLabelCommand({
			entity: entity as never,
			sourceId: '42',
			integrationId: 'integration-1',
			organizationId: 'org-1'
		});
	const setup = (integrationMapService: object, tagService: object = { findOneByIdString: jest.fn() }) => {
		const execute = jest.fn();
		const handler = new IntegrationMapSyncLabelHandler(
			{ execute } as never,
			integrationMapService as never,
			tagService as never
		);
		return { execute, handler };
	};

	beforeEach(() => jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1'));
	afterEach(() => jest.restoreAllMocks());

	it('rejects when the update of the mapped tag fails, creating nothing', async () => {
		const integrationMap = { id: 'map-1', gauzyId: 'tag-1' };
		const integrationMapService = { findOneByWhereOptions: jest.fn().mockResolvedValue(integrationMap) };
		const tagService = { findOneByIdString: jest.fn().mockResolvedValue({ id: 'tag-1' }) };
		const { execute, handler } = setup(integrationMapService, tagService);
		execute.mockRejectedValue(new Error('update failed'));

		await expect(handler.execute(command())).rejects.toThrow('update failed');

		expect(execute).toHaveBeenCalledTimes(1);
		const [[update]] = execute.mock.calls;
		expect(update).toBeInstanceOf(TagUpdateCommand);
		expect(update.id).toBe('tag-1');
	});

	it('creates the tag and its map once when the label is not mapped yet', async () => {
		const integrationMapService = { findOneByWhereOptions: jest.fn().mockRejectedValue(new NotFoundException('The requested record was not found')) };
		const { execute, handler } = setup(integrationMapService);
		execute.mockResolvedValueOnce({ id: 'tag-new' }).mockResolvedValueOnce({ id: 'map-new' });

		expect(await handler.execute(command())).toEqual({ id: 'tag-new' });

		expect(execute).toHaveBeenCalledTimes(2);
		const [[create], [map]] = execute.mock.calls;
		expect(create).toBeInstanceOf(TagCreateCommand);
		expect(create.input).toEqual({ ...entity, organizationId: 'org-1', tenantId: 'tenant-1' });
		expect(map).toBeInstanceOf(IntegrationMapSyncEntityCommand);
		expect(map.input).toMatchObject({
			gauzyId: 'tag-new',
			entity: IntegrationEntity.LABEL,
			sourceId: '42',
			integrationId: 'integration-1',
			organizationId: 'org-1',
			tenantId: 'tenant-1'
		});
	});

	it('re-creates the tag under the mapped id when the mapped tag no longer exists', async () => {
		const integrationMap = { id: 'map-1', gauzyId: 'tag-1' };
		const integrationMapService = { findOneByWhereOptions: jest.fn().mockResolvedValue(integrationMap) };
		const tagService = { findOneByIdString: jest.fn().mockRejectedValue(new NotFoundException('The requested record was not found')) };
		const { execute, handler } = setup(integrationMapService, tagService);
		execute.mockResolvedValue({ id: 'tag-1' });

		expect(await handler.execute(command())).toEqual({ id: 'tag-1' });

		expect(execute).toHaveBeenCalledTimes(1);
		const [[create]] = execute.mock.calls;
		expect(create).toBeInstanceOf(TagCreateCommand);
		expect(create.input).toMatchObject({ id: 'tag-1', name: 'bug' });
	});
});

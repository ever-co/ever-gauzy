import '../../core/entities/internal';

import { IsNull } from 'typeorm';
import { TenantAwareCrudService } from '../../core/crud';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TaskMetadataService } from '../task-metadata.service';
import { TaskStatusService } from './status.service';

/**
 * `markAsDefault` cleared `isDefault` with a filter holding only the scopes the input supplied, so marking an
 * organization's default status also cleared the defaults of every project and team of the organization (and a
 * project's, those of its teams). A scope the input does not supply is now pinned to NULL, as `fetchAll` reads it.
 */
describe('TaskStatusService.markAsDefault — the cleared scope', () => {
	const fixture = createTenantFixture();

	let restore: () => void;
	let update: jest.SpyInstance;
	let service: TaskStatusService;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue({ id: 'item-1' } as never);
		update = jest.spyOn(TenantAwareCrudService.prototype, 'update').mockResolvedValue({ affected: 1 } as never);
		jest.spyOn(TenantAwareCrudService.prototype, 'save').mockImplementation(async (entity) => entity as never);
		jest.spyOn(TaskMetadataService.prototype, 'fetchAll').mockResolvedValue({ items: [], total: 0 });
		service = Object.create(TaskStatusService.prototype);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('clears only the organization-level defaults for an organization-level request', async () => {
		await service.markAsDefault('item-1', { organizationId: fixture.organizationId } as never);

		expect(update).toHaveBeenCalledWith(
			{
				organizationId: fixture.organizationId,
				organizationTeamId: IsNull(),
				projectId: IsNull(),
				tenantId: fixture.tenantId,
				isSystem: false
			},
			{ isDefault: false }
		);
	});

	it('clears only the project-level defaults for a project-level request', async () => {
		await service.markAsDefault('item-1', {
			organizationId: fixture.organizationId,
			projectId: 'project-1'
		} as never);

		expect(update).toHaveBeenCalledWith(
			{
				organizationId: fixture.organizationId,
				organizationTeamId: IsNull(),
				projectId: 'project-1',
				tenantId: fixture.tenantId,
				isSystem: false
			},
			{ isDefault: false }
		);
	});

	it('clears the team-level defaults of the team a request names', async () => {
		await service.markAsDefault('item-1', {
			organizationId: fixture.organizationId,
			organizationTeamId: 'team-1'
		} as never);

		expect(update).toHaveBeenCalledWith(
			expect.objectContaining({ organizationTeamId: 'team-1', projectId: IsNull() }),
			{ isDefault: false }
		);
	});

	it("completes a project-only request with the row's own organization", async () => {
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue({
			id: 'item-1',
			organizationId: fixture.organizationId,
			projectId: 'project-1',
			organizationTeamId: null
		} as never);

		await service.markAsDefault('item-1', { projectId: 'project-1' } as never);

		expect(update).toHaveBeenCalledWith(
			{
				organizationId: fixture.organizationId,
				organizationTeamId: IsNull(),
				projectId: 'project-1',
				tenantId: fixture.tenantId,
				isSystem: false
			},
			{ isDefault: false }
		);
	});
});

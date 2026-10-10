import '../core/entities/internal';

import { CrudService } from '../core/crud/crud.service';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { OrganizationSprintService } from './organization-sprint.service';

/**
 * `OrganizationSprintService.update` saved the sprint only together with a member change: completing a
 * sprint (`isActive: false`), editing its name or dates, or moving a task into it sent no member ids, so
 * nothing was saved while the request still succeeded with the unchanged sprint.
 */
describe('OrganizationSprintService.update', () => {
	const fixture = createTenantFixture();
	const stored = { id: 'sprint-1', name: 'Sprint 1', projectId: 'project-1', isActive: true };

	let restore: () => void;
	let create: jest.SpyInstance;
	let updateMembers: jest.SpyInstance;
	let activityLogService: { logActivity: jest.Mock };
	let service: OrganizationSprintService;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		jest.spyOn(CrudService.prototype, 'findOneByIdString').mockResolvedValue(stored as never);
		create = jest.spyOn(CrudService.prototype, 'create').mockImplementation(async (entity) => entity as never);
		updateMembers = jest
			.spyOn(OrganizationSprintService.prototype, 'updateOrganizationSprintMembers')
			.mockResolvedValue(undefined);
		activityLogService = { logActivity: jest.fn() };
		const stub = {};
		service = new OrganizationSprintService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'organization_sprint', hasColumnWithPropertyPath: () => false } } as any,
			...(Array.from({ length: 4 }, () => stub) as [never, never, never, never]),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ publish: jest.fn() } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			stub as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ findActiveEmployeesByEmployeeIds: jest.fn().mockResolvedValue([]) } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			stub as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			activityLogService as any
		);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('saves an update that changes no member (e.g. completing the sprint)', async () => {
		const updated = await service.update('sprint-1', { organizationId: fixture.organizationId, isActive: false });

		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'sprint-1', isActive: false, tenantId: fixture.tenantId })
		);
		expect(updateMembers).not.toHaveBeenCalled();
		// Logged under the stored name, which the partial update does not carry
		expect(activityLogService.logActivity.mock.calls[0][4]).toBe('Sprint 1');
		expect(updated).toMatchObject({ id: 'sprint-1', isActive: false });
	});

	it('still updates the members, then saves the sprint, when member ids are given', async () => {
		await service.update('sprint-1', {
			organizationId: fixture.organizationId,
			name: 'Sprint 1 (renamed)',
			memberIds: ['employee-1']
		});

		expect(updateMembers).toHaveBeenCalledWith('sprint-1', fixture.organizationId, [], [], ['employee-1']);
		expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: 'sprint-1', name: 'Sprint 1 (renamed)' }));
	});
});

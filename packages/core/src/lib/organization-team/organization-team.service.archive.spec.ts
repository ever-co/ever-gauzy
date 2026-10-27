import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationTeamService } from './organization-team.service';

/**
 * A team the organization finished with is archived: it keeps its members, projects and history and stays
 * readable by its id, but no list offers it unless the caller asks for archived teams. Archiving is an edit of
 * the team, so a caller who may not act for every employee must manage the team, as for editing or deleting it.
 * (`findAll` is read against a real database in organization-team.service.with-deleted.spec.ts.)
 */

const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';
const stored = { id: 'team-1', name: 'Gauzy', organizationId: ORGANIZATION, tenantId: TENANT };

let service: OrganizationTeamService;
let permissions: PermissionsEnum[];
let saved: Record<string, any>;
let findOneByIdString: jest.SpyInstance;

beforeEach(() => {
	permissions = [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE];
	saved = undefined;
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue('employee-1');
	jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
		permissions.includes(permission)
	);
	findOneByIdString = jest
		.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString')
		.mockResolvedValue({ ...stored } as never);
	jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(async (entity) => {
		saved = entity;
		return { ...stored, ...entity } as never;
	});

	service = Object.create(OrganizationTeamService.prototype);
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('OrganizationTeamService.setArchived', () => {
	it('archives the team, stamping when, and writes nothing else', async () => {
		const archived = await service.setArchived('team-1', true);

		expect(Object.keys(saved).sort()).toEqual(['archivedAt', 'id', 'isArchived', 'organizationId', 'tenantId']);
		expect(saved).toMatchObject({ id: 'team-1', organizationId: ORGANIZATION, tenantId: TENANT, isArchived: true });
		expect(saved.archivedAt).toBeInstanceOf(Date);
		expect(archived).toMatchObject({ id: 'team-1', name: 'Gauzy', isArchived: true });
	});

	it('unarchives the team, clearing the stamp', async () => {
		await service.setArchived('team-1', false);

		expect(saved).toMatchObject({ id: 'team-1', isArchived: false, archivedAt: null });
	});

	it('lets a manager of the team archive it without CHANGE_SELECTED_EMPLOYEE', async () => {
		permissions = [PermissionsEnum.ORG_TEAM_EDIT];

		await service.setArchived('team-1', true);

		// The manager membership was looked up for this team, with the MANAGER role
		expect(findOneByIdString).toHaveBeenCalledWith(
			'team-1',
			expect.objectContaining({
				where: expect.objectContaining({ members: expect.objectContaining({ employeeId: 'employee-1' }) })
			})
		);
		expect(saved).toMatchObject({ isArchived: true });
	});

	it('refuses a caller who neither acts for every employee nor manages the team, and writes nothing', async () => {
		permissions = [PermissionsEnum.ORG_TEAM_EDIT];
		findOneByIdString
			.mockResolvedValueOnce({ ...stored } as never)
			.mockRejectedValueOnce(new Error('not a manager'));

		await expect(service.setArchived('team-1', true)).rejects.toBeInstanceOf(ForbiddenException);
		expect(saved).toBeUndefined();
	});
});

describe('OrganizationTeamService.countBy', () => {
	it('counts the teams that are not archived, unless the caller states `isArchived`', async () => {
		const countBy = jest.spyOn(TenantAwareCrudService.prototype, 'countBy').mockResolvedValue(0);

		await service.countBy({ organizationId: ORGANIZATION } as never);
		await service.countBy({ organizationId: ORGANIZATION, isArchived: 'true' } as never);

		expect(countBy).toHaveBeenNthCalledWith(1, { organizationId: ORGANIZATION, isArchived: false });
		expect(countBy).toHaveBeenNthCalledWith(2, { organizationId: ORGANIZATION, isArchived: true });
	});
});

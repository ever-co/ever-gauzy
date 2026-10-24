import '../core/entities/internal';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationTeamService } from './organization-team.service';

/**
 * `PUT /organization-team/:id` (and `addMember`, which goes through the same edit) let a caller without
 * CHANGE_SELECTED_EMPLOYEE edit only a team they manage, but checked that only when the caller had an
 * employee identity. Any user holding ORG_TEAM_EDIT (the default EMPLOYEE role does) with no employee
 * record skipped the check and rewrote any team of the tenant, its members and managers included.
 */
describe('OrganizationTeamService.update manager rule', () => {
	const TENANT = '71000000-0000-4000-8000-00000000000a';
	const ORGANIZATION = '71000000-0000-4000-8000-0000000000a1';
	const TEAM = '71000000-0000-4000-8000-000000000001';
	const EMPLOYEE = '71000000-0000-4000-8000-0000000000e1';
	const INPUT = { organizationId: ORGANIZATION, name: 'renamed' } as any;

	let findOneByIdString: jest.SpyInstance;
	let create: jest.SpyInstance;
	let service: OrganizationTeamService;

	beforeEach(() => {
		findOneByIdString = jest
			.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString')
			.mockImplementation(async () => ({ id: TEAM }) as never);
		create = jest
			.spyOn(TenantAwareCrudService.prototype, 'create')
			.mockImplementation(async (entity: any) => entity);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);

		// Only the collaborators these paths touch; the rest of the constructor graph is irrelevant here.
		service = Object.create(OrganizationTeamService.prototype);
	});

	afterEach(() => jest.restoreAllMocks());

	const callerHolds = (permissions: PermissionsEnum[], employeeId: string | null) => {
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((p) => permissions.includes(p as never));
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(employeeId);
	};

	it('refuses a caller without CHANGE_SELECTED_EMPLOYEE who has no employee identity', async () => {
		callerHolds([PermissionsEnum.ORG_TEAM_EDIT], null);

		await expect(service.update(TEAM, INPUT)).rejects.toBeInstanceOf(ForbiddenException);

		expect(create).not.toHaveBeenCalled();
	});

	it('refuses an employee who does not manage the team', async () => {
		callerHolds([PermissionsEnum.ORG_TEAM_EDIT], EMPLOYEE);
		findOneByIdString.mockImplementation(async (_id, options: any) => {
			if (options?.where?.members) {
				throw new NotFoundException();
			}
			return { id: TEAM };
		});

		await expect(service.update(TEAM, INPUT)).rejects.toBeInstanceOf(ForbiddenException);

		expect(create).not.toHaveBeenCalled();
	});

	it('lets a manager of the team edit it', async () => {
		callerHolds([PermissionsEnum.ORG_TEAM_EDIT], EMPLOYEE);

		await expect(service.update(TEAM, INPUT)).resolves.toMatchObject({ id: TEAM, name: 'renamed' });

		expect(findOneByIdString).toHaveBeenCalledWith(
			TEAM,
			expect.objectContaining({
				where: expect.objectContaining({
					members: expect.objectContaining({ employeeId: EMPLOYEE, role: { name: RolesEnum.MANAGER } })
				})
			})
		);
		expect(create).toHaveBeenCalledTimes(1);
	});

	it('lets a caller with CHANGE_SELECTED_EMPLOYEE edit any team, employee or not', async () => {
		callerHolds([PermissionsEnum.ORG_TEAM_EDIT, PermissionsEnum.CHANGE_SELECTED_EMPLOYEE], null);

		await expect(service.update(TEAM, INPUT)).resolves.toMatchObject({ id: TEAM, tenantId: TENANT });

		expect(create).toHaveBeenCalledTimes(1);
	});
});

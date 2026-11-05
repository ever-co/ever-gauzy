import '../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationProject } from '../core/entities/internal';
import { OrganizationTeamService } from './organization-team.service';

/**
 * Ever Teams creates a project with each team and filed every new task under whichever project the team listed
 * first: with several projects that was arbitrary. The team now names its default project. It must be a project of
 * the team's organization, since the members' new tasks and time are filed under it.
 */
describe('OrganizationTeamService — default project', () => {
	const ORGANIZATION = 'organization-1';
	const TENANT = 'tenant-1';
	const projects = [
		{ id: 'project-own', organizationId: ORGANIZATION, tenantId: TENANT },
		{ id: 'project-elsewhere', organizationId: 'organization-2', tenantId: TENANT }
	];

	let saved: Record<string, unknown> | undefined;
	let findProject: jest.Mock;
	let updateOrganizationTeam: jest.Mock;
	let service: OrganizationTeamService;

	beforeEach(() => {
		saved = undefined;
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue('role-admin');
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
		jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(async (entity) => {
			saved = entity as Record<string, unknown>;
			return { id: 'team-1', ...entity } as never;
		});
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue({
			id: 'team-1',
			organizationId: ORGANIZATION,
			tenantId: TENANT
		} as never);

		updateOrganizationTeam = jest.fn(async () => undefined);
		findProject = jest.fn(async (entity: unknown, { where }: { where: Record<string, unknown> }) => {
			if (entity !== OrganizationProject) {
				return null;
			}
			const match = projects.find(
				(project) =>
					project.id === where.id &&
					project.organizationId === where.organizationId &&
					project.tenantId === where.tenantId
			);
			return match ?? null;
		});

		service = Object.create(OrganizationTeamService.prototype);
		Object.assign(service, {
			typeOrmRepository: { manager: { findOne: findProject } },
			roleService: {
				findOneByIdString: jest.fn().mockRejectedValue(new Error('not an employee')),
				findOneByWhereOptions: jest.fn().mockResolvedValue({ id: 'role-manager', name: RolesEnum.MANAGER })
			},
			retrieveEmployees: jest.fn().mockResolvedValue([]),
			organizationTeamEmployeeService: { updateOrganizationTeam },
			employeeService: {},
			_eventBus: { publish: jest.fn() }
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	const createTeam = (defaultProjectId?: string | null) =>
		service.create({ name: 'Support', organizationId: ORGANIZATION, defaultProjectId } as never);

	const updateTeam = (defaultProjectId?: string | null) =>
		service.update('team-1', { organizationId: ORGANIZATION, defaultProjectId } as never);

	it('stores the default project a new team names', async () => {
		await createTeam('project-own');

		expect(saved).toEqual(expect.objectContaining({ defaultProjectId: 'project-own' }));
	});

	it('creates a team without a default project as before', async () => {
		await createTeam();

		expect(findProject).not.toHaveBeenCalled();
		expect(saved?.defaultProjectId).toBeUndefined();
	});

	it('refuses a default project of another organization, on create and on update', async () => {
		await expect(createTeam('project-elsewhere')).rejects.toThrow(BadRequestException);
		await expect(updateTeam('project-elsewhere')).rejects.toThrow(BadRequestException);

		expect(saved).toBeUndefined();
	});

	it('changes or clears the default project on update', async () => {
		await updateTeam('project-own');
		expect(saved).toEqual(expect.objectContaining({ defaultProjectId: 'project-own' }));

		await updateTeam(null);
		expect(saved).toEqual(expect.objectContaining({ defaultProjectId: null }));
	});

	it('refuses a foreign default project before it changes any member', async () => {
		const edit = service.update('team-1', {
			organizationId: ORGANIZATION,
			memberIds: ['employee-1'],
			defaultProjectId: 'project-elsewhere'
		} as never);

		await expect(edit).rejects.toThrow(BadRequestException);
		expect(updateOrganizationTeam).not.toHaveBeenCalled();
	});

	it('checks against the organization the body names only as a relation', async () => {
		const updateNamingRelation = (defaultProjectId: string) =>
			service.update('team-1', { organization: { id: ORGANIZATION }, defaultProjectId } as never);

		await expect(updateNamingRelation('project-elsewhere')).rejects.toThrow(BadRequestException);
		await updateNamingRelation('project-own');

		expect(saved).toEqual(expect.objectContaining({ defaultProjectId: 'project-own' }));
	});

	describe('a team moved to another organization', () => {
		beforeEach(() => {
			jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue({
				id: 'team-1',
				organizationId: ORGANIZATION,
				tenantId: TENANT,
				defaultProjectId: 'project-own'
			} as never);
		});

		const moveTeam = (defaultProjectId?: string | null) =>
			service.update('team-1', { organization: { id: 'organization-2' }, defaultProjectId } as never);

		it('cannot keep a default project of the organization it leaves', async () => {
			await expect(moveTeam()).rejects.toThrow(BadRequestException);
			await expect(moveTeam('project-own')).rejects.toThrow(BadRequestException);

			expect(saved).toBeUndefined();
		});

		it('takes a default project of the organization it joins, or none', async () => {
			await moveTeam('project-elsewhere');
			expect(saved).toEqual(expect.objectContaining({ defaultProjectId: 'project-elsewhere' }));

			await moveTeam(null);
			expect(saved).toEqual(expect.objectContaining({ defaultProjectId: null }));
		});
	});

	it('looks no project up when an update neither names a default project nor moves the team', async () => {
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue({
			id: 'team-1',
			organizationId: ORGANIZATION,
			tenantId: TENANT,
			defaultProjectId: 'project-own'
		} as never);

		await service.update('team-1', { organizationId: ORGANIZATION, name: 'Support' } as never);

		expect(findProject).not.toHaveBeenCalled();
		expect(saved).toEqual(expect.objectContaining({ name: 'Support' }));
	});
});

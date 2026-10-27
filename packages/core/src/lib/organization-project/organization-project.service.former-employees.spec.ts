import '../core/entities/internal';

import { In } from 'typeorm';
import { RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService, TenantAwareCrudService } from '../core/crud';
import { MultiORMEnum } from '../core/utils';
import { OrganizationProjectService } from './organization-project.service';

/**
 * "End Work" deactivates and archives an employee but keeps their project memberships, so that "Back to Work"
 * restores them. The Projects page still listed them among a project's members and managers, and the project's
 * edit form, whose employee picker offers working employees only, could not take them off. The project reads now
 * leave them out, and an edit keeps their memberships instead of deleting the rows it no longer sees.
 */

const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';

/** The working employees: everyone but `employee-ended`. */
const WORKING = new Set(['employee-a', 'employee-b', 'employee-c']);

let employeeFind: jest.Mock;
let service: OrganizationProjectService;

beforeEach(() => {
	jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);

	employeeFind = jest.fn().mockImplementation(async ({ where }) =>
		// `where.id` is TypeORM's In(): its value is the list of ids looked up
		(where.id.value as string[]).filter((id) => WORKING.has(id)).map((id) => ({ id }))
	);
	service = Object.create(OrganizationProjectService.prototype);
	Object.assign(service, {
		_employeeService: { find: employeeFind },
		_employeeRecentVisitService: { emitSaveEmployeeRecentVisitEvent: jest.fn() }
	});
});

afterEach(() => {
	jest.restoreAllMocks();
});

const member = (employeeId: string, extra: Record<string, unknown> = {}) => ({
	id: `row-${employeeId}`,
	employeeId,
	employee: { id: employeeId },
	...extra
});

/** A project as the Projects page reads it: members with a manager, and a team with its own members. */
const project = () => ({
	id: 'project-1',
	name: 'Ever Works',
	membersCount: 3,
	members: [
		member('employee-a', { isManager: true, role: { name: RolesEnum.MANAGER } }),
		member('employee-ended', { isManager: true, role: { name: RolesEnum.MANAGER } }),
		member('employee-b')
	],
	teams: [{ id: 'team-1', members: [member('employee-c'), member('employee-ended')] }]
});

const employeeIdsOf = (members: Array<{ employeeId?: string }>) => members.map(({ employeeId }) => employeeId);

describe('OrganizationProjectService reads — members whose work ended are not listed', () => {
	it('pagination (the Projects page) leaves them out of the members and of the teams’ members', async () => {
		jest.spyOn(TenantAwareCrudService.prototype, 'paginate').mockResolvedValue({
			items: [project()],
			total: 1
		} as never);

		const { items } = await service.pagination({ where: { organizationId: ORGANIZATION } } as never);

		expect(employeeIdsOf(items[0].members)).toEqual(['employee-a', 'employee-b']);
		expect(employeeIdsOf(items[0].teams[0].members)).toEqual(['employee-c']);
		// One lookup for the whole page, of every employee read, for the working ones only
		expect(employeeFind).toHaveBeenCalledTimes(1);
		expect(employeeFind).toHaveBeenCalledWith({
			where: {
				id: In(['employee-a', 'employee-ended', 'employee-b', 'employee-c']),
				isActive: true,
				isArchived: false
			}
		});
	});

	it('findAll leaves them out', async () => {
		jest.spyOn(TenantAwareCrudService.prototype, 'findAll').mockResolvedValue({
			items: [project()],
			total: 1
		} as never);

		const { items } = await service.findAll({} as never);

		expect(employeeIdsOf(items[0].members)).toEqual(['employee-a', 'employee-b']);
	});

	it('findById (the project page and its edit form) leaves them out', async () => {
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue(project() as never);

		const found = await service.findById('project-1', { relations: ['members.employee.user'] } as never);

		expect(employeeIdsOf(found.members)).toEqual(['employee-a', 'employee-b']);
		expect(employeeIdsOf(found.teams[0].members)).toEqual(['employee-c']);
	});

	it('findByEmployee leaves them out', async () => {
		const query = {
			alias: 'organization_project',
			setFindOptions: jest.fn(),
			innerJoin: jest.fn().mockReturnThis(),
			leftJoin: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getMany: jest.fn().mockResolvedValue([project()])
		};
		Object.assign(service, {
			assertRelationsPermitted: jest.fn(),
			typeOrmRepository: {
				metadata: { tableName: 'organization_project' },
				createQueryBuilder: jest.fn().mockReturnValue(query)
			}
		});

		const [found] = await service.findByEmployee('employee-a', {
			organizationId: ORGANIZATION,
			relations: ['members']
		} as never);

		expect(employeeIdsOf(found.members)).toEqual(['employee-a', 'employee-b']);
	});

	it('names the employee of a MikroORM membership through its relation, which leaves `employeeId` unset', async () => {
		// MikroORM maps the column through `employee`: a loaded row carries the employee (or, serialized as a
		// reference, its key) and no `employeeId`. Reading `employeeId` alone left every working member out.
		const mikroOrmProject = {
			id: 'project-1',
			members: [
				{ id: 'row-a', employee: { id: 'employee-a' } },
				{ id: 'row-ended', employee: { id: 'employee-ended' } },
				{ id: 'row-b', employee: 'employee-b' }
			],
			teams: [
				{
					id: 'team-1',
					members: [
						{ id: 'row-c', employee: 'employee-c' },
						{ id: 'row-x', employee: 'employee-ended' }
					]
				}
			]
		};
		jest.spyOn(TenantAwareCrudService.prototype, 'findAll').mockResolvedValue({
			items: [mikroOrmProject],
			total: 1
		} as never);

		const { items } = await service.findAll({} as never);

		expect(items[0].members.map(({ id }) => id)).toEqual(['row-a', 'row-b']);
		expect(items[0].teams[0].members.map(({ id }) => id)).toEqual(['row-c']);
		expect(employeeFind.mock.calls[0][0].where.id).toEqual(
			In(['employee-a', 'employee-ended', 'employee-b', 'employee-c'])
		);
	});

	it('keeps a member whose employee the read does not name: only an employee known not to work is left out', async () => {
		jest.spyOn(TenantAwareCrudService.prototype, 'findAll').mockResolvedValue({
			items: [{ id: 'project-1', members: [{ id: 'row-unnamed' }, member('employee-ended')] }],
			total: 1
		} as never);

		const { items } = await service.findAll({} as never);

		expect(items[0].members.map(({ id }) => id)).toEqual(['row-unnamed']);
	});

	it('looks nothing up for projects read without their members', async () => {
		const { members: _members, teams: _teams, ...bare } = project();
		jest.spyOn(TenantAwareCrudService.prototype, 'paginate').mockResolvedValue({
			items: [bare],
			total: 1
		} as never);

		const { items } = await service.pagination({} as never);

		expect(items).toEqual([bare]);
		expect(employeeFind).not.toHaveBeenCalled();
	});
});

describe('OrganizationProjectService.updateOrganizationProjectMembers — members whose work ended', () => {
	function harness(existing: Array<Record<string, unknown>>) {
		const self = Object.create(OrganizationProjectService.prototype);
		Object.assign(self, {
			_employeeService: { find: employeeFind },
			_roleService: { findOneByWhereOptions: jest.fn().mockResolvedValue({ id: 'role-manager' }) },
			typeOrmOrganizationProjectEmployeeRepository: {
				find: jest.fn().mockResolvedValue(existing),
				update: jest.fn(),
				save: jest.fn()
			},
			deleteMemberByIds: jest.fn(),
			_entitySubscriptionService: { deleteForEmployee: jest.fn() },
			_eventBus: { publish: jest.fn() }
		});
		return self;
	}

	it('keeps the membership of an employee whose work ended, which the edit form never sends back', async () => {
		// The edit form lists employee-a and employee-b; employee-ended is not offered, so it is not sent.
		const self = harness([
			{ id: 'row-a', employeeId: 'employee-a', roleId: null },
			{ id: 'row-ended', employeeId: 'employee-ended', roleId: 'role-manager', isManager: true },
			{ id: 'row-b', employeeId: 'employee-b', roleId: null }
		]);

		await OrganizationProjectService.prototype.updateOrganizationProjectMembers.call(
			self,
			'project-1',
			ORGANIZATION,
			TENANT,
			[{ id: 'employee-a' }],
			[],
			['employee-a']
		);

		// employee-b, a working member taken off in the form, is removed; employee-ended is kept
		expect(self.deleteMemberByIds).toHaveBeenCalledTimes(1);
		expect(self.deleteMemberByIds).toHaveBeenCalledWith(['row-b']);
		expect(self._entitySubscriptionService.deleteForEmployee).toHaveBeenCalledTimes(1);
		expect(self._entitySubscriptionService.deleteForEmployee).toHaveBeenCalledWith(
			expect.objectContaining({ employeeId: 'employee-b' })
		);
	});

	it('removes nothing when the only member left out is one whose work ended', async () => {
		const self = harness([
			{ id: 'row-a', employeeId: 'employee-a', roleId: null },
			{ id: 'row-ended', employeeId: 'employee-ended', roleId: null }
		]);

		await OrganizationProjectService.prototype.updateOrganizationProjectMembers.call(
			self,
			'project-1',
			ORGANIZATION,
			TENANT,
			[{ id: 'employee-a' }],
			[],
			['employee-a']
		);

		expect(self.deleteMemberByIds).not.toHaveBeenCalled();
	});
});

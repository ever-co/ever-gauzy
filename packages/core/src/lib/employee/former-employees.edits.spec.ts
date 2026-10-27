import '../core/entities/internal';

import { RequestContext } from '../core/context';
import { OrganizationSprintService } from '../organization-sprint/organization-sprint.service';
import { OrganizationProjectModuleService } from '../organization-project-module/organization-project-module.service';
import { OrganizationDepartmentUpdateHandler } from '../organization-department/commands/handlers/organization-department.update.handler';
import { OrganizationDepartmentUpdateCommand } from '../organization-department/commands/organization-department.update.command';
import { OrganizationContactUpdateHandler } from '../organization-contact/commands/handlers/organization-contact-update.handler';
import { OrganizationContactUpdateCommand } from '../organization-contact/commands/organization-contact-update.command';

/**
 * The member lists never show an employee whose work ended, so a member edit never sends them back. Saving the
 * stated members as they are used to delete those memberships — Back to Work could no longer restore them. Each
 * edit now keeps them, and still removes a working member it takes off.
 */
const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
});

afterEach(() => jest.restoreAllMocks());

/** The collaborators of a membership-row edit over two existing rows: a working member and a former one. */
function membershipHarness(repositoryKey: string) {
	return {
		_employeeService: {
			findWorkingEmployeeIds: jest.fn(
				async (ids: string[]) => new Set(ids.filter((id) => id !== 'employee-ended'))
			)
		},
		_roleService: { findOneByWhereOptions: jest.fn().mockResolvedValue({ id: 'role-manager' }) },
		[repositoryKey]: {
			find: jest.fn().mockResolvedValue([
				{ id: 'row-working', employeeId: 'employee-working', roleId: null },
				{ id: 'row-ended', employeeId: 'employee-ended', roleId: null }
			]),
			update: jest.fn(),
			save: jest.fn()
		},
		deleteMemberByIds: jest.fn(),
		_entitySubscriptionService: { deleteForEmployee: jest.fn() },
		_eventBus: { publish: jest.fn() }
	};
}

describe.each([
	[
		'a sprint',
		OrganizationSprintService.prototype.updateOrganizationSprintMembers,
		'typeOrmOrganizationSprintEmployeeRepository'
	],
	[
		'a project module',
		OrganizationProjectModuleService.prototype.updateOrganizationProjectModuleMembers,
		'typeOrmOrganizationProjectModuleEmployeeRepository'
	]
])('editing the members of %s', (_name, updateMembers, repositoryKey) => {
	it('keeps the membership of an employee whose work ended, and removes a working member taken off', async () => {
		const self = membershipHarness(repositoryKey);

		// The edit states nobody: the former employee was never shown, the working one was taken off
		await (updateMembers as (...args: unknown[]) => Promise<void>).call(self, 'record-1', ORGANIZATION, [], [], []);

		expect(self._employeeService.findWorkingEmployeeIds).toHaveBeenCalledWith([
			'employee-working',
			'employee-ended'
		]);
		expect(self.deleteMemberByIds).toHaveBeenCalledTimes(1);
		expect(self.deleteMemberByIds).toHaveBeenCalledWith(['row-working']);
	});
});

describe('editing the members of a department or a client (many-to-many)', () => {
	const linked = [
		{ id: 'employee-working', isActive: true, isArchived: false },
		{ id: 'employee-ended', isActive: false, isArchived: true }
	];

	it('keeps a department linked to its former employees the edit could not see', async () => {
		const service = {
			findOneByIdString: jest.fn().mockResolvedValue({ id: 'department-1', members: linked }),
			create: jest.fn(async (entity) => entity)
		};
		const handler = new OrganizationDepartmentUpdateHandler(service as never);

		await handler.execute(
			new OrganizationDepartmentUpdateCommand('department-1', {
				name: 'Engineering',
				members: [{ id: 'employee-new' }]
			} as never)
		);

		// The department is read live first; its links are read with the deleted employees too
		expect(service.findOneByIdString).toHaveBeenNthCalledWith(1, 'department-1');
		expect(service.findOneByIdString).toHaveBeenNthCalledWith(2, 'department-1', {
			relations: { members: true },
			withDeleted: true
		});
		expect(service.create.mock.calls[0][0].members.map(({ id }) => id)).toEqual(['employee-new', 'employee-ended']);
	});

	it('keeps a link to a soft-deleted employee, whose flags a soft delete keeps', async () => {
		const service = {
			findOneByIdString: jest.fn().mockResolvedValue({
				id: 'department-1',
				members: [
					...linked,
					{ id: 'employee-deleted', isActive: true, isArchived: false, deletedAt: '2026-10-01T00:00:00Z' }
				]
			}),
			create: jest.fn(async (entity) => entity)
		};
		const handler = new OrganizationDepartmentUpdateHandler(service as never);

		await handler.execute(
			new OrganizationDepartmentUpdateCommand('department-1', { members: [{ id: 'employee-working' }] } as never)
		);

		expect(service.create.mock.calls[0][0].members.map(({ id }) => id)).toEqual([
			'employee-working',
			'employee-ended',
			'employee-deleted'
		]);
	});

	it('refuses to edit the members of a deleted department, reading its links only once it is found live', async () => {
		const service = {
			findOneByIdString: jest.fn().mockRejectedValueOnce(new Error('not found')),
			create: jest.fn()
		};
		const handler = new OrganizationDepartmentUpdateHandler(service as never);

		await expect(
			handler.execute(new OrganizationDepartmentUpdateCommand('department-1', { members: [] } as never))
		).rejects.toThrow('not found');
		expect(service.findOneByIdString).toHaveBeenCalledTimes(1);
		expect(service.create).not.toHaveBeenCalled();
	});

	it('leaves a department’s members alone when the edit does not state them', async () => {
		const service = { findOneByIdString: jest.fn(), create: jest.fn(async (entity) => entity) };
		const handler = new OrganizationDepartmentUpdateHandler(service as never);

		await handler.execute(new OrganizationDepartmentUpdateCommand('department-1', { name: 'Ops' } as never));

		expect(service.findOneByIdString).not.toHaveBeenCalled();
		expect(service.create.mock.calls[0][0]).not.toHaveProperty('members');
	});

	it('keeps a client linked to its former employees the edit could not see', async () => {
		const organizationContactService = {
			findOneByIdString: jest.fn().mockResolvedValue({ id: 'contact-1', members: linked }),
			create: jest.fn(async (entity) => entity)
		};
		const contactService = { create: jest.fn(async (contact) => contact) };
		const handler = new OrganizationContactUpdateHandler(
			organizationContactService as never,
			contactService as never
		);

		await handler.execute(
			new OrganizationContactUpdateCommand('contact-1', {
				name: 'Acme',
				organizationId: ORGANIZATION,
				members: [{ id: 'employee-working' }]
			} as never)
		);

		expect(organizationContactService.create.mock.calls[0][0].members.map(({ id }) => id)).toEqual([
			'employee-working',
			'employee-ended'
		]);
	});
});

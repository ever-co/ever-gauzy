import '../core/entities/internal';

import { BaseEntityEnum, EmployeeNotificationTypeEnum, EntitySubscriptionTypeEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { EmployeeCreateNotificationEvent } from '../employee-notification/events/employee-notification.event';
import { CreateEntitySubscriptionEvent } from '../entity-subscription/events';
import { OrganizationProjectService } from './organization-project.service';

/**
 * What a project's members are told (ever-co/ever-teams#5022): that they were added to it, from wherever they were
 * added (the project's form, the employee's projects). Before, an employee added to a project heard nothing, and one
 * added from their own page did not even follow it.
 */

const TENANT = 'tenant-1';
const ORGANIZATION = 'org-1';

let publish: jest.Mock;

beforeEach(() => {
	publish = jest.fn();
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue('employee-admin');
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
		firstName: 'Ada',
		lastName: 'Lovelace',
		employeeId: 'employee-admin'
	} as never);
});

afterEach(() => jest.restoreAllMocks());

const published = <T>(type: new (...args: never[]) => T): T[] =>
	publish.mock.calls.map(([event]) => event).filter((event): event is T => event instanceof type);

describe('OrganizationProjectService.updateOrganizationProjectMembers — the new members are told', () => {
	it('tells each new member they were added, by the project name, and not the editor who added themselves', async () => {
		const self = {
			_roleService: { findOneByWhereOptions: jest.fn().mockResolvedValue({ id: 'role-manager' }) },
			typeOrmOrganizationProjectEmployeeRepository: {
				find: jest.fn().mockResolvedValue([{ id: 'row-a', employeeId: 'employee-a', roleId: null }]),
				update: jest.fn(),
				save: jest.fn()
			},
			deleteMemberByIds: jest.fn(),
			findWorkingEmployeeIds: jest.fn().mockImplementation(async (ids: string[]) => new Set(ids)),
			_entitySubscriptionService: { deleteForEmployee: jest.fn() },
			_eventBus: { publish }
		};
		Object.setPrototypeOf(self, OrganizationProjectService.prototype);

		await OrganizationProjectService.prototype.updateOrganizationProjectMembers.call(
			self,
			'project-1',
			ORGANIZATION,
			TENANT,
			[{ id: 'employee-a' }, { id: 'employee-b' }, { id: 'employee-admin' }],
			[],
			['employee-a', 'employee-b', 'employee-admin'],
			'Website'
		);

		// employee-a was a member already; the admin added themselves
		expect(published(EmployeeCreateNotificationEvent).map(({ input }) => input)).toEqual([
			{
				entity: BaseEntityEnum.OrganizationProject,
				entityId: 'project-1',
				type: EmployeeNotificationTypeEnum.ASSIGNMENT,
				title: 'Ada Lovelace Assigned you to the Project "Website"',
				receiverEmployeeId: 'employee-b',
				sentByEmployeeId: 'employee-admin',
				organizationId: ORGANIZATION,
				tenantId: TENANT
			}
		]);
	});
});

describe('OrganizationProjectService.updateByEmployee — a member added from their own page', () => {
	function serviceWith(projects: Array<{ id: string; name: string; members: Array<{ employeeId: string }> }>) {
		const service = Object.create(OrganizationProjectService.prototype);
		Object.assign(service, {
			find: jest.fn().mockResolvedValue(projects),
			saveMany: jest.fn(),
			typeOrmOrganizationProjectEmployeeRepository: { delete: jest.fn() },
			_entitySubscriptionService: { deleteForEmployee: jest.fn() },
			_eventBus: { publish }
		});
		return service as unknown as Pick<OrganizationProjectService, 'updateByEmployee'> & {
			_entitySubscriptionService: { deleteForEmployee: jest.Mock };
		};
	}

	it('follows and is told of each project they were added to, and only of those they were not in yet', async () => {
		const service = serviceWith([
			{ id: 'project-new', name: 'Website', members: [] },
			{ id: 'project-in', name: 'Mobile', members: [{ employeeId: 'employee-b' }] }
		]);

		await service.updateByEmployee({
			organizationId: ORGANIZATION,
			addedProjectIds: ['project-new', 'project-in'],
			removedProjectIds: [],
			member: { id: 'employee-b' }
		} as never);

		expect(published(CreateEntitySubscriptionEvent).map(({ input }) => input)).toEqual([
			{
				entity: BaseEntityEnum.OrganizationProject,
				entityId: 'project-new',
				employeeId: 'employee-b',
				type: EntitySubscriptionTypeEnum.ASSIGNMENT,
				organizationId: ORGANIZATION,
				tenantId: TENANT
			}
		]);
		expect(published(EmployeeCreateNotificationEvent).map(({ input }) => [input.entityId, input.receiverEmployeeId, input.title])).toEqual([
			['project-new', 'employee-b', 'Ada Lovelace Assigned you to the Project "Website"']
		]);
	});

	it('no longer follows the projects they were taken off', async () => {
		const service = serviceWith([]);

		await service.updateByEmployee({
			organizationId: ORGANIZATION,
			addedProjectIds: [],
			removedProjectIds: ['project-old'],
			member: { id: 'employee-b' }
		} as never);

		expect(service._entitySubscriptionService.deleteForEmployee).toHaveBeenCalledWith({
			entity: BaseEntityEnum.OrganizationProject,
			entityId: 'project-old',
			employeeId: 'employee-b',
			type: EntitySubscriptionTypeEnum.ASSIGNMENT,
			organizationId: ORGANIZATION,
			tenantId: TENANT
		});
		expect(published(EmployeeCreateNotificationEvent)).toEqual([]);
	});
});

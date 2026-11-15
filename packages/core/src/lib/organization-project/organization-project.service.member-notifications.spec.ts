import '../core/entities/internal';

import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
	EntitySubscriptionTypeEnum,
	ProjectStatusEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { EmployeeCreateNotificationEvent } from '../employee-notification/events/employee-notification.event';
import { CreateEntitySubscriptionEvent } from '../entity-subscription/events';
import { OrganizationProjectChangedEvent } from './events/organization-project-changed.event';
import { OrganizationProjectService } from './organization-project.service';

/**
 * What a project's members are told (ever-co/ever-teams#5022): that they were added to it, from wherever they were
 * added (the project's form, the employee's projects), and, through the project's followers, that its status, dates or
 * archiving changed. Before, an employee added to a project heard nothing, and one added from their own page did not
 * even follow it.
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
			// The private projects kept from the caller (ever-co/ever-gauzy#11465): none here
			typeOrmRepository: { find: jest.fn().mockResolvedValue([]) },
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
		expect(
			published(EmployeeCreateNotificationEvent).map(({ input }) => [
				input.entityId,
				input.receiverEmployeeId,
				input.title
			])
		).toEqual([['project-new', 'employee-b', 'Ada Lovelace Assigned you to the Project "Website"']]);
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

describe('OrganizationProjectService — the members hear of the changes that matter to them', () => {
	const before = {
		id: 'project-1',
		name: 'Website',
		organizationId: ORGANIZATION,
		tenantId: TENANT,
		status: ProjectStatusEnum.IN_PROGRESS,
		startDate: new Date('2026-11-01T00:00:00.000Z'),
		endDate: null,
		isArchived: false,
		teams: []
	};

	function service() {
		const service = Object.create(OrganizationProjectService.prototype);
		Object.assign(service, {
			findOneByIdString: jest.fn().mockResolvedValue({ ...before }),
			prepareTaskKey: jest.fn(),
			_activityLogService: { logActivity: jest.fn() },
			// The private projects kept from the caller (ever-co/ever-gauzy#11465): none here
			typeOrmRepository: { find: jest.fn().mockResolvedValue([]) },
			_eventBus: { publish }
		});
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue({ ...before } as never);
		jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(
			async (input) => ({ ...before, ...input }) as never
		);
		jest.spyOn(TenantAwareCrudService.prototype, 'update').mockResolvedValue({} as never);
		return service as OrganizationProjectService;
	}

	it('publishes what an edit changed in the status or the dates', async () => {
		await service().update('project-1', {
			organizationId: ORGANIZATION,
			status: ProjectStatusEnum.COMPLETED,
			endDate: new Date('2026-12-15T00:00:00.000Z'),
			name: 'Website'
		} as never);

		const [event] = published(OrganizationProjectChangedEvent);
		expect(event.project).toEqual({
			id: 'project-1',
			name: 'Website',
			organizationId: ORGANIZATION,
			tenantId: TENANT
		});
		expect(event.changes).toEqual([
			{ field: 'status', from: 'in progress', to: 'completed' },
			{ field: 'endDate', from: null, to: '2026-12-15' }
		]);
	});

	it('publishes nothing for an edit that changes neither', async () => {
		await service().update('project-1', {
			organizationId: ORGANIZATION,
			name: 'Website 2',
			description: 'More'
		} as never);

		expect(published(OrganizationProjectChangedEvent)).toEqual([]);
	});

	it('publishes that an edit archived the project, after what it changed in the status', async () => {
		await service().update('project-1', {
			organizationId: ORGANIZATION,
			status: ProjectStatusEnum.COMPLETED,
			isArchived: true
		} as never);

		const [event] = published(OrganizationProjectChangedEvent);
		expect(event.changes).toEqual([
			{ field: 'status', from: 'in progress', to: 'completed' },
			{ field: 'archived', from: 'false', to: 'true' }
		]);
	});

	it('publishes nothing for an edit that names the archive state the project already has', async () => {
		await service().update('project-1', { organizationId: ORGANIZATION, isArchived: false } as never);

		expect(published(OrganizationProjectChangedEvent)).toEqual([]);
	});

	it('publishes that the project was archived', async () => {
		await service().setArchived('project-1', true);

		const [event] = published(OrganizationProjectChangedEvent);
		expect(event.changes).toEqual([{ field: 'archived', from: 'false', to: 'true' }]);
	});
});

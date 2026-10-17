import '../core/entities/internal';

import { BaseEntityEnum, EntitySubscriptionTypeEnum, IUser } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TaskService } from './task.service';

/**
 * `TaskService.update` unsubscribes the members a save removed from the task. It computed them as "the task's
 * members that are not in `input.members`", so an update that does not carry `members` at all — the estimate
 * recalculated after an estimation changes, a module or screening-task update, any partial PUT — counted every
 * assignee as removed and deleted their ASSIGNMENT subscriptions: they stopped receiving the task's notifications.
 */
describe('TaskService.update — assignee subscriptions', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'caller-employee' } as IUser });
	const memberA = { id: 'employee-a' };
	const memberB = { id: 'employee-b' };

	let restore: () => void;
	let entitySubscriptionService: { delete: jest.Mock; deleteForEmployee: jest.Mock };
	let service: TaskService;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		entitySubscriptionService = { delete: jest.fn(), deleteForEmployee: jest.fn() };
		// The task as stored: two assignees
		const stored = {
			id: 'task-1',
			title: 'Task 1',
			organizationId: fixture.organizationId,
			projectId: 'project-1',
			members: [memberA, memberB]
		};
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue(stored as never);
		jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(
			async (entity) => ({ ...stored, ...entity }) as never
		);
		service = Object.create(TaskService.prototype);
		Object.assign(service, {
			_entitySubscriptionService: entitySubscriptionService,
			_activityLogService: { logActivity: jest.fn() },
			_eventBus: { publish: jest.fn() },
			_employeeNotificationService: { publishNotificationEvent: jest.fn() }
		});
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	const unsubscribed = () =>
		[...entitySubscriptionService.delete.mock.calls, ...entitySubscriptionService.deleteForEmployee.mock.calls].map(
			([criteria]) => criteria.employeeId
		);

	it('keeps every assignee subscribed when the update does not carry members (e.g. the estimate)', async () => {
		await service.update('task-1', { estimate: 3 });

		expect(unsubscribed()).toEqual([]);
	});

	it('still unsubscribes the assignee a save removed', async () => {
		await service.update('task-1', { members: [memberA] as never });

		expect(unsubscribed()).toEqual(['employee-b']);
		const [[criteria]] = [
			...entitySubscriptionService.delete.mock.calls,
			...entitySubscriptionService.deleteForEmployee.mock.calls
		];
		expect(criteria).toMatchObject({
			entity: BaseEntityEnum.Task,
			entityId: 'task-1',
			employeeId: 'employee-b',
			type: EntitySubscriptionTypeEnum.ASSIGNMENT,
			organizationId: fixture.organizationId,
			tenantId: fixture.tenantId
		});
	});
});

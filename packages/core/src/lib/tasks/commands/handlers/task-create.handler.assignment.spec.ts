import '../../../core/entities/internal';

import { Logger } from '@nestjs/common';
import {
	BaseEntityEnum,
	EmployeeNotificationTypeEnum,
	EntitySubscriptionTypeEnum,
	ITaskCreateInput,
	IUser,
	NotificationActionTypeEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	asTenantUser,
	createTenantFixture,
	ITenantFixture
} from '../../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { CreateEntitySubscriptionEvent } from '../../../entity-subscription/events';
import { TaskCreateCommand } from '../task-create.command';
import { TaskCreateHandler } from './task-create.handler';

/**
 * A task created with assignees notified each of them without a `receiverEmployeeId` (nor a sender), so the
 * ASSIGNMENT notification reached no one. The update path (`TaskService.subscribeNewMembers`) addresses it to the
 * assignee and names the employee who assigned them; creation must do the same.
 *
 * #12137 — the creator is added to the members of every task they create, and was then notified that they had
 * assigned themselves ("Creator assigned you", sent by the creator to the creator). The creator stays a member and
 * keeps their subscriptions, but only the other assignees are notified.
 */
describe('TaskCreateHandler — assignment notifications', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'creator-employee', name: 'Creator' } as IUser });

	let restore: () => void;
	let publishNotificationEvent: jest.Mock;
	let taskService: { getMaxTaskNumberByProject: jest.Mock; create: jest.Mock };
	let employeeService: { findOneByIdString: jest.Mock; findActiveEmployeesByEmployeeIds: jest.Mock };
	let cqrsEventBus: { publish: jest.Mock };
	let self: Record<string, unknown>;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		publishNotificationEvent = jest.fn();
		taskService = {
			getMaxTaskNumberByProject: jest.fn().mockResolvedValue(0),
			create: jest.fn(async (task) => ({ id: 'task-1', ...task }))
		};
		employeeService = {
			findOneByIdString: jest.fn(async (id: string) => ({ id })),
			findActiveEmployeesByEmployeeIds: jest.fn(async (ids: string[]) => ids.map((id) => ({ id })))
		};
		cqrsEventBus = { publish: jest.fn() };
		self = {
			logger: new Logger('TaskCreateHandlerSpec'),
			_taskService: taskService,
			_organizationProjectService: { findOneByIdString: jest.fn() },
			_employeeService: employeeService,
			_cqrsEventBus: cqrsEventBus,
			_eventBus: { publish: jest.fn() },
			activityLogService: { logActivity: jest.fn() },
			employeeNotificationService: { publishNotificationEvent }
		};
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	/** Acts as another caller than the default creator for the rest of the test */
	const actAs = (caller: ITenantFixture, options?: { permissions?: PermissionsEnum[] }) => {
		restore();
		({ restore } = asTenantUser(caller, options));
	};

	const create = (members: { id: string }[], organizationId = fixture.organizationId) =>
		TaskCreateHandler.prototype.execute.call(
			self,
			new TaskCreateCommand({ title: 'New task', organizationId, members } as ITaskCreateInput, false)
		);

	const receivers = () => publishNotificationEvent.mock.calls.map(([input]) => input.receiverEmployeeId).sort();
	const savedMemberIds = () => taskService.create.mock.calls[0][0].members.map(({ id }) => id).sort();
	const subscriptions = () =>
		cqrsEventBus.publish.mock.calls
			.map(([event]) => event)
			.filter((event) => event instanceof CreateEntitySubscriptionEvent)
			.map(({ input }) => input);

	it('sends no assignment notification for a task its creator made alone, and keeps them a member', async () => {
		await create([]);

		expect(savedMemberIds()).toEqual(['creator-employee']);
		// The members were processed — the creator is subscribed as assignee — yet no notification was sent
		expect(subscriptions()).toContainEqual(
			expect.objectContaining({ employeeId: 'creator-employee', type: EntitySubscriptionTypeEnum.ASSIGNMENT })
		);
		expect(publishNotificationEvent).not.toHaveBeenCalled();
	});

	it('notifies the other assignee only, addressed to them and sent by the creator', async () => {
		await create([{ id: 'employee-a' }]);

		// The creator is still added to the members automatically
		expect(savedMemberIds()).toEqual(['creator-employee', 'employee-a']);
		expect(publishNotificationEvent).toHaveBeenCalledTimes(1);
		expect(publishNotificationEvent).toHaveBeenCalledWith(
			{
				entity: BaseEntityEnum.Task,
				entityId: 'task-1',
				type: EmployeeNotificationTypeEnum.ASSIGNMENT,
				organizationId: fixture.organizationId,
				tenantId: fixture.tenantId,
				receiverEmployeeId: 'employee-a',
				sentByEmployeeId: 'creator-employee'
			},
			NotificationActionTypeEnum.Assigned,
			'New task',
			'Creator'
		);
	});

	it('notifies every other assignee once, and not the creator who listed themselves', async () => {
		await create([{ id: 'employee-a' }, { id: 'creator-employee' }, { id: 'employee-b' }, { id: 'employee-c' }]);

		// Listing the creator explicitly neither duplicates their membership nor notifies them
		expect(savedMemberIds()).toEqual(['creator-employee', 'employee-a', 'employee-b', 'employee-c']);
		expect(receivers()).toEqual(['employee-a', 'employee-b', 'employee-c']);
		for (const [input, action, title, senderName] of publishNotificationEvent.mock.calls) {
			expect(input).toMatchObject({
				entityId: 'task-1',
				type: EmployeeNotificationTypeEnum.ASSIGNMENT,
				organizationId: fixture.organizationId,
				tenantId: fixture.tenantId,
				sentByEmployeeId: 'creator-employee'
			});
			expect([action, title, senderName]).toEqual([NotificationActionTypeEnum.Assigned, 'New task', 'Creator']);
		}
	});

	it('keeps the creator subscribed as creator and assignee, and every other assignee subscribed', async () => {
		await create([{ id: 'employee-a' }, { id: 'employee-b' }]);

		const scope = {
			entity: BaseEntityEnum.Task,
			entityId: 'task-1',
			organizationId: fixture.organizationId,
			tenantId: fixture.tenantId
		};
		expect(subscriptions()).toEqual(
			expect.arrayContaining([
				{ ...scope, employeeId: 'creator-employee', type: EntitySubscriptionTypeEnum.CREATED_ENTITY },
				...['creator-employee', 'employee-a', 'employee-b'].map((employeeId) => ({
					...scope,
					employeeId,
					type: EntitySubscriptionTypeEnum.ASSIGNMENT
				}))
			])
		);
		expect(subscriptions()).toHaveLength(4);
	});

	it('still notifies every assignee when the caller has no employee', async () => {
		const caller = createTenantFixture({ user: { name: 'Integration' } as IUser });
		actAs(caller);

		await create([{ id: 'employee-a' }, { id: 'employee-b' }], caller.organizationId);

		expect(employeeService.findOneByIdString).not.toHaveBeenCalled();
		expect(savedMemberIds()).toEqual(['employee-a', 'employee-b']);
		expect(receivers()).toEqual(['employee-a', 'employee-b']);
		for (const [input] of publishNotificationEvent.mock.calls) {
			expect(input).toMatchObject({ organizationId: caller.organizationId, tenantId: caller.tenantId });
			expect(input.sentByEmployeeId).toBeUndefined();
		}
	});

	it('does not notify a caller who may change the selected employee and listed themselves', async () => {
		// `currentEmployeeId()` is null for this caller, so they are not added to the members automatically,
		// but they still send the notifications and must not receive their own
		actAs(fixture, { permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE] });

		await create([{ id: 'creator-employee' }, { id: 'employee-a' }]);

		expect(employeeService.findOneByIdString).not.toHaveBeenCalled();
		expect(savedMemberIds()).toEqual(['creator-employee', 'employee-a']);
		expect(receivers()).toEqual(['employee-a']);
		expect(publishNotificationEvent.mock.calls[0][0].sentByEmployeeId).toBe('creator-employee');
	});
});

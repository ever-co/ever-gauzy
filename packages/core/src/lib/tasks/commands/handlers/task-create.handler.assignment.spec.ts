import '../../../core/entities/internal';

import { Logger } from '@nestjs/common';
import { EmployeeNotificationTypeEnum, ITaskCreateInput, IUser } from '@gauzy/contracts';
import { asTenantUser, createTenantFixture } from '../../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TaskCreateCommand } from '../task-create.command';
import { TaskCreateHandler } from './task-create.handler';

/**
 * A task created with assignees notified each of them without a `receiverEmployeeId` (nor a sender), so the
 * ASSIGNMENT notification reached no one. The update path (`TaskService.subscribeNewMembers`) addresses it to the
 * assignee and names the employee who assigned them; creation must do the same.
 */
describe('TaskCreateHandler — assignment notifications', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'creator-employee', name: 'Creator' } as IUser });

	let restore: () => void;
	let publishNotificationEvent: jest.Mock;
	let self: Record<string, unknown>;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		publishNotificationEvent = jest.fn();
		self = {
			logger: new Logger('TaskCreateHandlerSpec'),
			_taskService: {
				getMaxTaskNumberByProject: jest.fn().mockResolvedValue(0),
				create: jest.fn(async (task) => ({ id: 'task-1', ...task }))
			},
			_organizationProjectService: { findOneByIdString: jest.fn() },
			_employeeService: {
				findOneByIdString: jest.fn().mockResolvedValue({ id: 'creator-employee' }),
				findActiveEmployeesByEmployeeIds: jest.fn(async (ids: string[]) => ids.map((id) => ({ id })))
			},
			_cqrsEventBus: { publish: jest.fn() },
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

	it('addresses each assignment notification to the assignee, sent by the creator', async () => {
		await TaskCreateHandler.prototype.execute.call(
			self,
			new TaskCreateCommand(
				{
					title: 'New task',
					organizationId: fixture.organizationId,
					members: [{ id: 'employee-a' }]
				} as ITaskCreateInput,
				false
			)
		);

		const inputs = publishNotificationEvent.mock.calls.map(([input]) => input);
		// The assignee and the creator, who is added to the members automatically
		expect(inputs.map((input) => input.receiverEmployeeId).sort()).toEqual(['creator-employee', 'employee-a']);
		for (const input of inputs) {
			expect(input).toMatchObject({
				entityId: 'task-1',
				type: EmployeeNotificationTypeEnum.ASSIGNMENT,
				organizationId: fixture.organizationId,
				tenantId: fixture.tenantId,
				sentByEmployeeId: 'creator-employee'
			});
		}
	});
});

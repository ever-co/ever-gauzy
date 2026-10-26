import '../core/entities/internal';

import { IUser } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TaskService } from './task.service';

/**
 * `TaskService.update` read the organization and the title from the save result (and the sprint history
 * organization from the input). The save returns what was written, so a partial update — only the estimate, only
 * the members, only the sprint — handed `undefined` to the activity log, the assignee subscriptions and the sprint
 * history. They must fall back to the stored task.
 */
describe('TaskService.update — partial updates keep the stored organization and title', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'caller-employee' } as IUser });
	const stored = {
		id: 'task-1',
		title: 'Stored title',
		organizationId: fixture.organizationId,
		organizationSprintId: 'sprint-1',
		projectId: 'project-1',
		members: []
	};

	let restore: () => void;
	let logActivity: jest.Mock;
	let publish: jest.Mock;
	let saveHistory: jest.Mock;
	let service: TaskService;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		logActivity = jest.fn();
		publish = jest.fn();
		saveHistory = jest.fn();
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue(stored as never);
		// The save returns only what was written, as a partial save does
		jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(async (entity) => ({ ...entity }) as never);
		service = Object.create(TaskService.prototype);
		Object.assign(service, {
			typeOrmOrganizationSprintTaskHistoryRepository: { save: saveHistory },
			_entitySubscriptionService: { delete: jest.fn() },
			_activityLogService: { logActivity },
			_eventBus: { publish },
			_employeeNotificationService: { publishNotificationEvent: jest.fn() }
		});
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('logs the activity with the stored organization and title', async () => {
		await service.update('task-1', { estimate: 3 });

		expect(logActivity).toHaveBeenCalledTimes(1);
		const [, , , entityId, title, , organizationId] = logActivity.mock.calls[0];
		expect(entityId).toBe('task-1');
		expect(title).toBe('Stored title');
		expect(organizationId).toBe(fixture.organizationId);
	});

	it('subscribes a new assignee in the stored organization', async () => {
		await service.update('task-1', { members: [{ id: 'employee-a' }] as never });

		expect(publish).toHaveBeenCalledTimes(1);
		const [[event]] = publish.mock.calls;
		expect(event.input).toMatchObject({ employeeId: 'employee-a', organizationId: fixture.organizationId });
	});

	it('records the sprint move in the stored organization', async () => {
		await service.update('task-1', { organizationSprintId: 'sprint-2' } as never);

		expect(saveHistory).toHaveBeenCalledWith(
			expect.objectContaining({
				fromSprintId: 'sprint-1',
				toSprintId: 'sprint-2',
				organizationId: fixture.organizationId,
				tenantId: fixture.tenantId
			})
		);
	});
});

// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { IUser, TimeLogSourceEnum } from '@gauzy/contracts';
import { Task } from '../../core/entities/internal';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimeLogCreateCommand } from '../time-log/commands';
import { TimerService } from './timer.service';

/**
 * Timer starts from the Ever Teams clients name a task and, in the versions already installed (the mobile app among
 * them), no project, so their time showed under no project in the reports. Such a start now files the log under the
 * task's project; a start that names a project, and the other clients, keep what they send.
 */
describe('TimerService.startTimer filing the log under the task project', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'employee-1' } as IUser });
	const employee = {
		id: 'employee-1',
		organizationId: fixture.organizationId,
		tenantId: fixture.tenantId,
		isTrackingEnabled: true
	};

	let restore: () => void;
	let service: TimerService;
	let execute: jest.Mock;
	let findTask: jest.Mock;

	const loggedProjectId = () => {
		const create = execute.mock.calls.find(([command]) => command instanceof TimeLogCreateCommand)?.[0];
		return (create as TimeLogCreateCommand | undefined)?.input.projectId;
	};

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		findTask = jest.fn(async () => ({ id: 'task-1', projectId: 'project-of-task' }));
		execute = jest.fn(async () => ({ id: 'log-new' }));
		const employeeService = { findOneByUserId: jest.fn(async () => employee), update: jest.fn() };
		service = new TimerService(
			{ manager: { findOne: findTask } } as never,
			undefined as never,
			undefined as never,
			undefined as never,
			employeeService as never,
			{ execute } as never,
			undefined as never
		);
		Object.assign(service, { stopPreviousRunningTimers: jest.fn(async () => undefined) });
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it.each([TimeLogSourceEnum.TEAMS, TimeLogSourceEnum.MOBILE])(
		"files a %s start without a project under the task's project",
		async (source) => {
			await service.startTimer({ source, taskId: 'task-1' });

			expect(findTask).toHaveBeenCalledWith(Task, {
				where: { id: 'task-1', tenantId: fixture.tenantId, organizationId: fixture.organizationId },
				select: { id: true, projectId: true }
			});
			expect(loggedProjectId()).toBe('project-of-task');
		}
	);

	it('keeps the project a start names', async () => {
		await service.startTimer({ source: TimeLogSourceEnum.TEAMS, taskId: 'task-1', projectId: 'project-named' });

		expect(findTask).not.toHaveBeenCalled();
		expect(loggedProjectId()).toBe('project-named');
	});

	it('leaves the project empty for a task without one, or a start without a task', async () => {
		findTask.mockResolvedValue({ id: 'task-1', projectId: null });
		await service.startTimer({ source: TimeLogSourceEnum.TEAMS, taskId: 'task-1' });
		expect(loggedProjectId()).toBeNull();

		execute.mockClear();
		await service.startTimer({ source: TimeLogSourceEnum.TEAMS });
		expect(loggedProjectId()).toBeNull();
	});

	it.each([TimeLogSourceEnum.DESKTOP, TimeLogSourceEnum.WEB_TIMER])(
		'leaves a %s start as it was, without reading the task',
		async (source) => {
			await service.startTimer({ source, taskId: 'task-1' });

			expect(findTask).not.toHaveBeenCalled();
			expect(loggedProjectId()).toBeNull();
		}
	);
});

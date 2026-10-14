import '../../core/entities/internal';

import { ScreeningTaskStatusEnum, TaskStatusEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../../core/crud';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { ScreeningTasksService } from './screening-tasks.service';

/**
 * Changing a screening task's status must update its task: accepted -> a regular task, declined or
 * duplicated -> cancelled. The status was compared with the entity just saved, which always carries the
 * new status, so the task was never updated.
 */
describe('ScreeningTasksService.update', () => {
	const fixture = createTenantFixture();
	const task = { id: 'task-1', number: 7, title: 'Investigate', status: TaskStatusEnum.OPEN };

	let restore: () => void;
	let taskService: { update: jest.Mock };
	let activityLogService: { logActivity: jest.Mock };
	let self: Record<string, unknown>;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(
			async (entity) => ({ ...entity, organizationId: fixture.organizationId }) as never
		);
		taskService = { update: jest.fn() };
		activityLogService = { logActivity: jest.fn() };
		self = {
			findOneByIdString: jest.fn().mockResolvedValue({
				id: 'screening-1',
				status: ScreeningTaskStatusEnum.PENDING,
				task
			}),
			taskService,
			activityLogService
		};
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	const update = (status?: ScreeningTaskStatusEnum) =>
		ScreeningTasksService.prototype.update.call(self, 'screening-1', status ? { status } : {});

	it('turns the task into a regular task once accepted', async () => {
		await update(ScreeningTaskStatusEnum.ACCEPTED);

		expect(taskService.update).toHaveBeenCalledWith('task-1', {
			isScreeningTask: false,
			status: TaskStatusEnum.OPEN
		});
	});

	it.each([ScreeningTaskStatusEnum.DECLINED, ScreeningTaskStatusEnum.DUPLICATED])(
		'cancels the task when %s',
		async (status) => {
			await update(status);

			expect(taskService.update).toHaveBeenCalledWith('task-1', {
				isScreeningTask: false,
				status: TaskStatusEnum.CANCELLED
			});
		}
	);

	it('keeps the task a screening task when snoozed', async () => {
		await update(ScreeningTaskStatusEnum.SNOOZED);

		expect(taskService.update).toHaveBeenCalledWith('task-1', {
			isScreeningTask: true,
			status: TaskStatusEnum.OPEN
		});
	});

	it('leaves the task alone when the status does not change, or is not sent', async () => {
		await update(ScreeningTaskStatusEnum.PENDING);
		await update();

		expect(taskService.update).not.toHaveBeenCalled();
	});

	it('does not save the screening status when the task update fails, so a retry still syncs the task', async () => {
		const create = jest.mocked(TenantAwareCrudService.prototype.create);
		taskService.update.mockRejectedValueOnce(new Error('database timeout'));

		await expect(update(ScreeningTaskStatusEnum.ACCEPTED)).rejects.toThrow();
		expect(create).not.toHaveBeenCalled();

		await update(ScreeningTaskStatusEnum.ACCEPTED);
		expect(taskService.update).toHaveBeenCalledTimes(2);
		expect(create).toHaveBeenCalledTimes(1);
	});

	it('logs the stored screening task as the previous values', async () => {
		await update(ScreeningTaskStatusEnum.ACCEPTED);

		expect(activityLogService.logActivity.mock.calls[0][8]).toMatchObject({ status: ScreeningTaskStatusEnum.PENDING });
	});
});

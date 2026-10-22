import '../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { TaskUpdateCommand } from './commands';
import { TaskController } from './task.controller';

/**
 * `PUT /tasks/:id/status` moves a task to another status and writes nothing else. The organization in the
 * body is the caller's context: the task must be one of it, and it never reaches the update, so the route
 * cannot move a task of another organization in the same tenant, nor move a task to another organization.
 */
describe('TaskController.updateStatus — the status alone, on a task of the caller’s organization', () => {
	const organizationId = 'organization-1';
	const stored = { id: 'task-1', title: 'Stored title', organizationId };

	let findOneByIdString: jest.Mock;
	let execute: jest.Mock;
	let controller: TaskController;

	beforeEach(() => {
		findOneByIdString = jest.fn().mockResolvedValue(stored);
		execute = jest.fn().mockResolvedValue({ ...stored, status: 'in-progress' });
		controller = Object.create(TaskController.prototype);
		Object.assign(controller, { taskService: { findOneByIdString }, commandBus: { execute } });
	});

	it('updates only the status and the status row', async () => {
		await controller.updateStatus('task-1', {
			organizationId,
			status: 'in-progress',
			taskStatusId: 'status-1'
		} as never);

		expect(findOneByIdString).toHaveBeenCalledWith('task-1');
		expect(execute).toHaveBeenCalledTimes(1);
		const command = execute.mock.calls[0][0] as TaskUpdateCommand;
		expect(command).toBeInstanceOf(TaskUpdateCommand);
		expect(command.id).toBe('task-1');
		expect(command.input).toEqual({ status: 'in-progress', taskStatusId: 'status-1' });
	});

	it('refuses a task of another organization as not found, writing nothing', async () => {
		findOneByIdString.mockResolvedValue({ ...stored, organizationId: 'organization-2' });

		await expect(
			controller.updateStatus('task-1', { organizationId, status: 'done', taskStatusId: 'status-2' } as never)
		).rejects.toBeInstanceOf(NotFoundException);
		expect(execute).not.toHaveBeenCalled();
	});

	it('writes nothing when the task cannot be read', async () => {
		findOneByIdString.mockRejectedValue(new NotFoundException());

		await expect(
			controller.updateStatus('task-1', { organizationId, status: 'done', taskStatusId: 'status-2' } as never)
		).rejects.toBeInstanceOf(NotFoundException);
		expect(execute).not.toHaveBeenCalled();
	});
});

import '../../../../core/entities/internal';

import { TaskEstimationCalculateCommand } from '../task-estimation-calculate.command';
import { TaskEstimationCalculateHandler, averageEstimate } from './task-estimation-calculate.handler';

/**
 * A task's estimate is the average of every member's estimation. The handler read the estimations with a
 * plain `findAll`, which a caller without CHANGE_SELECTED_EMPLOYEE only sees their own of, and divided by
 * zero once the last estimation was deleted.
 */
describe('TaskEstimationCalculateHandler', () => {
	it("averages everybody's estimations, read through findAllForTask", async () => {
		const taskEstimationService = {
			findAllForTask: jest.fn().mockResolvedValue([{ estimate: 2 }, { estimate: 8 }, { estimate: 5 }]),
			findAll: jest.fn()
		};
		const taskService = { update: jest.fn() };
		const handler = new TaskEstimationCalculateHandler(taskEstimationService as never, taskService as never);

		await handler.execute(new TaskEstimationCalculateCommand('task-1'));

		expect(taskEstimationService.findAllForTask).toHaveBeenCalledWith('task-1');
		expect(taskEstimationService.findAll).not.toHaveBeenCalled();
		expect(taskService.update).toHaveBeenCalledWith('task-1', { estimate: 5 });
	});

	it('clears the estimate once the last estimation is deleted', async () => {
		const taskService = { update: jest.fn() };
		const handler = new TaskEstimationCalculateHandler(
			{ findAllForTask: jest.fn().mockResolvedValue([]) } as never,
			taskService as never
		);

		await handler.execute(new TaskEstimationCalculateCommand('task-1'));

		expect(taskService.update).toHaveBeenCalledWith('task-1', { estimate: null });
	});
});

describe('averageEstimate', () => {
	it('rounds the average up', () => {
		expect(averageEstimate([2, 3])).toBe(3);
	});

	it('is null without estimations', () => {
		expect(averageEstimate([])).toBeNull();
	});
});

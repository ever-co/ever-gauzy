import '../../../core/entities/internal';

import { ExpenseUpdateCommand } from '../expense.update.command';
import { ExpenseUpdateHandler } from './expense.update.handler';

/**
 * `PUT /expense/:id` whitelists the body against UpdateExpenseDTO, which has no `employeeId`, so the saved
 * partial carries none. The employee's average must still be refreshed, from the stored expense.
 */
describe('ExpenseUpdateHandler', () => {
	it("refreshes the stored expense's employee average when the request has no employeeId", async () => {
		const expenseService = {
			findOneByIdString: jest.fn().mockResolvedValue({ id: 'x-1', employeeId: 'e-1' }),
			create: jest.fn().mockResolvedValue({ id: 'x-1', amount: 250 }),
			countStatistic: jest.fn().mockReturnValue(125)
		};
		const employeeService = { create: jest.fn() };
		const employeeStatisticsService = {
			getStatisticsByEmployeeId: jest.fn().mockResolvedValue({ expenseStatistics: [] })
		};
		const handler = new ExpenseUpdateHandler(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expenseService as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			employeeService as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			employeeStatisticsService as any
		);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await handler.execute(new ExpenseUpdateCommand('x-1', { amount: 250 } as any));

		expect(employeeStatisticsService.getStatisticsByEmployeeId).toHaveBeenCalledWith('e-1');
		expect(employeeService.create).toHaveBeenCalledWith({ id: 'e-1', averageExpenses: 125 });
	});
});

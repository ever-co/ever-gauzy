import '../../../core/entities/internal';

import { IncomeUpdateCommand } from '../income.update.command';
import { IncomeUpdateHandler } from './income.update.handler';

/**
 * `PUT /income/:id` whitelists the body against UpdateIncomeDTO, which has no `employeeId`, so the saved
 * partial carries none. The employee's averages must still be refreshed, from the stored income.
 */
describe('IncomeUpdateHandler', () => {
	it("refreshes the stored income's employee averages when the request has no employeeId", async () => {
		const incomeService = {
			findOneByIdString: jest.fn().mockResolvedValue({ id: 'i-1', employeeId: 'e-1' }),
			create: jest.fn().mockResolvedValue({ id: 'i-1', amount: 250 }),
			countStatistic: jest.fn().mockReturnValue(125)
		};
		const employeeService = { create: jest.fn() };
		const employeeStatisticsService = {
			getStatisticsByEmployeeId: jest.fn().mockResolvedValue({ incomeStatistics: [], bonusStatistics: [] })
		};
		const handler = new IncomeUpdateHandler(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			incomeService as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			employeeService as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			employeeStatisticsService as any
		);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await handler.execute(new IncomeUpdateCommand('i-1', { amount: 250 } as any));

		expect(employeeStatisticsService.getStatisticsByEmployeeId).toHaveBeenCalledWith('e-1');
		expect(employeeService.create).toHaveBeenCalledWith({ id: 'e-1', averageIncome: 125, averageBonus: 125 });
	});
});

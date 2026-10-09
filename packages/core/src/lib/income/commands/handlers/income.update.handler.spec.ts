import '../../../core/entities/internal';

import { Logger } from '@nestjs/common';
import { IncomeUpdateCommand } from '../income.update.command';
import { IncomeUpdateHandler } from './income.update.handler';

/**
 * `PUT /income/:id` whitelists the body against UpdateIncomeDTO, which has no `employeeId`, so the saved
 * partial carries none. The employee's averages must still be refreshed, from the stored income.
 */
describe('IncomeUpdateHandler', () => {
	const saved = { id: 'i-1', amount: 250 };

	const setup = (statistics: () => Promise<unknown>) => {
		const incomeService = {
			findOneByIdString: jest.fn().mockResolvedValue({ id: 'i-1', employeeId: 'e-1' }),
			create: jest.fn().mockResolvedValue(saved),
			countStatistic: jest.fn().mockReturnValue(125)
		};
		const employeeService = { create: jest.fn() };
		const employeeStatisticsService = { getStatisticsByEmployeeId: jest.fn(statistics) };
		const handler = new IncomeUpdateHandler(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			incomeService as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			employeeService as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			employeeStatisticsService as any
		);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const execute = () => handler.execute(new IncomeUpdateCommand('i-1', { amount: 250 } as any));
		return { execute, employeeService, employeeStatisticsService };
	};

	afterEach(() => jest.restoreAllMocks());

	it("refreshes the stored income's employee averages without an employeeId in the request", async () => {
		const statistics = { incomeStatistics: [], bonusStatistics: [] };
		const { execute, employeeService, employeeStatisticsService } = setup(() => Promise.resolve(statistics));

		await expect(execute()).resolves.toBe(saved);

		expect(employeeStatisticsService.getStatisticsByEmployeeId).toHaveBeenCalledWith('e-1');
		expect(employeeService.create).toHaveBeenCalledWith({ id: 'e-1', averageIncome: 125, averageBonus: 125 });
	});

	it('reports the saved update as successful when the refresh fails', async () => {
		const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		const { execute, employeeService } = setup(() => Promise.reject(new Error('Employee not found')));

		await expect(execute()).resolves.toBe(saved);

		expect(employeeService.create).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('e-1'));
	});
});

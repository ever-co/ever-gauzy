import '../core/entities/internal';

import { EmployeeStatisticsService } from './employee-statistics.service';

/**
 * Caller-level regression for the recurring-expense loops: an expense that starts inside the requested
 * range is counted from its own month (the range start reaches the statistics as an ISO string, and
 * `Date > string` was always false), and a start on the 31st does not skip a shorter month.
 */
describe('EmployeeStatisticsService.organizationRecurringSplitExpenses months', () => {
	const months = async (range: { startDate: Date | string; endDate: Date | string }, expense: object) => {
		const employeeService = {
			findOneByOptions: jest.fn().mockResolvedValue({ organization: { id: 'org-1' } }),
			findWorkingEmployees: jest.fn().mockResolvedValue({ total: 1 })
		};
		const organizationRecurringExpenseService = { findAll: jest.fn().mockResolvedValue({ items: [expense] }) };
		const service = new EmployeeStatisticsService(
			{} as never,
			{} as never,
			{} as never,
			employeeService as never,
			organizationRecurringExpenseService as never
		);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const map = await service.organizationRecurringSplitExpenses('employee-1', range as any, 'org-1');
		return [...map.keys()];
	};

	it('counts an expense starting inside an ISO-string range only from its own month', async () => {
		expect(
			await months(
				{ startDate: '2024-01-01T00:00:00.000Z', endDate: '2024-03-31T23:59:59.999Z' },
				{ startDate: new Date('2024-02-15T12:00:00.000Z'), endDate: null, value: 300 }
			)
		).toEqual(['1-2024', '2-2024']);
	});

	it('does not skip February for an expense starting on January 31', async () => {
		expect(
			await months(
				{ startDate: new Date(2024, 0, 1), endDate: new Date(2024, 3, 30, 23, 59, 59) },
				{ startDate: new Date(2024, 0, 31), endDate: null, value: 300 }
			)
		).toEqual(['0-2024', '1-2024', '2-2024', '3-2024']);
	});

	it('stops at the expense end date', async () => {
		expect(
			await months(
				{ startDate: new Date(2024, 0, 1), endDate: new Date(2024, 11, 31) },
				{ startDate: new Date(2023, 5, 1), endDate: new Date(2024, 1, 20), value: 300 }
			)
		).toEqual(['0-2024', '1-2024']);
	});
});

import { RecurringExpensesEmployeeComponent } from './recurring-expense-employee.component';

/**
 * #10692: months are 0-based (`Date.getMonth()`), so January is 0. The page filled a missing start
 * month with `||`, which also replaced January with the month on screen.
 */
describe('RecurringExpensesEmployeeComponent — the start month it sends', () => {
	// May 2026 is the month on screen
	const page = {
		organization: { id: 'org-1' },
		selectedDateRange: { startDate: new Date(2026, 4, 1) },
		store: { user: { tenantId: 'tenant-1' } }
	};
	const dialogResult = (overrides: Record<string, unknown>) => ({
		employee: { id: 'employee-1' },
		categoryName: 'Rent',
		value: 100,
		currency: 'USD',
		startDay: 1,
		startYear: 2026,
		startDate: new Date(2026, 0, 1),
		...overrides
	});
	const transform = (result: Record<string, unknown>) =>
		(RecurringExpensesEmployeeComponent.prototype as any)._recurringExpenseMutationResultTransform.call(
			page,
			result
		);

	it('keeps January (month 0) when another month is on screen', () => {
		expect(transform(dialogResult({ startMonth: 0 })).startMonth).toBe(0);
	});

	it('keeps any other month the dialog sends', () => {
		expect(transform(dialogResult({ startMonth: 7 })).startMonth).toBe(7);
	});

	it('falls back to the month on screen when the dialog sends none', () => {
		expect(transform(dialogResult({ startMonth: undefined })).startMonth).toBe(4);
	});
});

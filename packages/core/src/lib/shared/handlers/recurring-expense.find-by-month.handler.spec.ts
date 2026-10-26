import { FindOperator } from 'typeorm';

/**
 * `/organization-recurring-expense/month` and `/employee-recurring-expense/month` list the expenses that apply to
 * one month. An open-ended expense (no end date) used to be returned in its first month only, and an expense
 * that starts or ends mid-month was missing from those two months.
 *
 * The core barrels are mocked out: the handler only needs `getDateRangeFormat` (passed through here) and the
 * current tenant, but those barrels re-export the whole entity graph.
 */
jest.mock('./../../core/utils', () => ({
	getDateRangeFormat: (start: { toDate: () => Date }, end: { toDate: () => Date }) => ({
		start: start.toDate(),
		end: end.toDate()
	})
}));
jest.mock('./../../core/context', () => ({ RequestContext: { currentTenantId: () => 'tenant-1' } }));
jest.mock('./../../core/crud', () => ({}));

import { FindRecurringExpenseByMonthHandler } from './recurring-expense.find-by-month.handler';

class TestHandler extends FindRecurringExpenseByMonthHandler<any> {}

const operator = (value: unknown) => value as FindOperator<Date>;

describe('FindRecurringExpenseByMonthHandler', () => {
	const monthStart = new Date('2026-03-01T00:00:00.000Z');
	const monthEnd = new Date('2026-03-31T23:59:59.999Z');

	let findAll: jest.Mock;
	let wheres: Record<string, unknown>[];

	beforeEach(async () => {
		findAll = jest.fn().mockResolvedValue({ items: [], total: 0 });
		const handler = new TestHandler({ findAll } as any);

		await handler.executeCommand({
			organizationId: 'org-1',
			startDate: monthStart.toISOString(),
			endDate: monthEnd.toISOString()
		});
		wheres = findAll.mock.calls[0][0].where;
	});

	it('matches an open-ended expense that started on or before the end of the month', () => {
		const [openEnded] = wheres;
		expect(openEnded).toMatchObject({ organizationId: 'org-1', tenantId: 'tenant-1' });
		expect(operator(openEnded.startDate).type).toBe('lessThanOrEqual');
		expect(operator(openEnded.startDate).value).toEqual(monthEnd);
		expect(operator(openEnded.endDate).type).toBe('isNull');
	});

	it('matches an expense whose period overlaps the month, including a mid-month start or end', () => {
		const [, bounded] = wheres;
		expect(operator(bounded.startDate).type).toBe('lessThanOrEqual');
		expect(operator(bounded.startDate).value).toEqual(monthEnd);
		expect(operator(bounded.endDate).type).toBe('moreThanOrEqual');
		expect(operator(bounded.endDate).value).toEqual(monthStart);
	});
});

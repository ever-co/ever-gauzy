import '../core/entities/internal';

import * as moment from 'moment';
import { ExpenseService } from './expense.service';

/**
 * `findAllExpenses(filter, filterDate)` limits expenses to the month of `filterDate`. The bounds used to
 * go through a 'YYYY-MM-DD hh:mm:ss' string, whose 12-hour `hh` turned the month into
 * "noon on the 1st to noon on the last day".
 */
describe('ExpenseService.findAllExpenses month range', () => {
	it('covers the whole month, from midnight on the 1st to the end of the last day', async () => {
		const findAll = jest.fn().mockResolvedValue({ items: [], total: 0 });

		await ExpenseService.prototype.findAllExpenses.call({ findAll }, undefined, '2026-09-15');

		const [start, end] = findAll.mock.calls[0][0].where.valueDate.value as Date[];
		expect(start).toEqual(moment('2026-09-15').startOf('month').toDate());
		expect(end).toEqual(moment('2026-09-15').endOf('month').toDate());
		expect(start.getHours()).toBe(0);
		expect(end.getHours()).toBe(23);
	});
});

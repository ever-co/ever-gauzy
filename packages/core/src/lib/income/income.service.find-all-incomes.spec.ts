import '../core/entities/internal';

import * as moment from 'moment';
import { IncomeService } from './income.service';

/**
 * `findAllIncomes(filter, filterDate)` limits incomes to the month of `filterDate`. An array (OR) `where`
 * must get the month range in each clause instead of being spread into one object.
 */
describe('IncomeService.findAllIncomes month range', () => {
	it('keeps the month range alongside an object filter', async () => {
		const findAll = jest.fn().mockResolvedValue({ items: [], total: 0 });

		await IncomeService.prototype.findAllIncomes.call(
			{ findAll },
			{ where: { organizationId: 'org-1' } },
			'2026-09-15'
		);

		const { where } = findAll.mock.calls[0][0];
		const [start, end] = where.valueDate.value as Date[];
		expect(start).toEqual(moment('2026-09-15').startOf('month').toDate());
		expect(end).toEqual(moment('2026-09-15').endOf('month').toDate());
		expect(where.organizationId).toBe('org-1');
	});

	it('adds the month range to every clause of an array (OR) filter', async () => {
		const findAll = jest.fn().mockResolvedValue({ items: [], total: 0 });
		const filter = { where: [{ organizationId: 'org-1' }, { employee: { id: 'employee-1' } }] };

		await IncomeService.prototype.findAllIncomes.call({ findAll }, filter, '2026-09-15');

		const { where } = findAll.mock.calls[0][0];
		expect(Array.isArray(where)).toBe(true);
		expect(where).toHaveLength(2);
		for (const clause of where) {
			const [start, end] = clause.valueDate.value as Date[];
			expect(start).toEqual(moment('2026-09-15').startOf('month').toDate());
			expect(end).toEqual(moment('2026-09-15').endOf('month').toDate());
			expect(clause).not.toHaveProperty('0');
		}
		expect(where[0]).toMatchObject({ organizationId: 'org-1' });
		expect(where[1]).toMatchObject({ employee: { id: 'employee-1' } });
	});

	it('reads an empty array filter as no filter, so the month range stays in place', async () => {
		const findAll = jest.fn().mockResolvedValue({ items: [], total: 0 });

		await IncomeService.prototype.findAllIncomes.call({ findAll }, { where: [] }, '2026-09-15');

		const { where } = findAll.mock.calls[0][0];
		expect(Array.isArray(where)).toBe(false);
		const [start, end] = where.valueDate.value as Date[];
		expect(start).toEqual(moment('2026-09-15').startOf('month').toDate());
		expect(end).toEqual(moment('2026-09-15').endOf('month').toDate());
	});
});

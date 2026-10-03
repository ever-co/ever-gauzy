import { byDurationDesc } from './statistic.service';

/**
 * The dashboard "Projects" widget shows the top 5 projects. The per-project totals used to keep the order
 * of the individual time logs (sorted by single-log duration), so a project with many short logs could be
 * cut from the top 5 even when it had the largest total.
 */
describe('byDurationDesc (projects statistics ranking)', () => {
	it('keeps the project with the largest total in the top 5', () => {
		// Five projects with one 3h log each, then one project with ten 2h logs (20h in total)
		const totals = [
			{ id: 'A', duration: 10800 },
			{ id: 'B', duration: 10800 },
			{ id: 'C', duration: 10800 },
			{ id: 'D', duration: 10800 },
			{ id: 'E', duration: 10800 },
			{ id: 'F', duration: 72000 }
		];

		const top = [...totals].sort(byDurationDesc).slice(0, 5);

		expect(top[0].id).toBe('F');
		expect(top).toHaveLength(5);
	});

	it('compares durations returned as strings by the database driver numerically', () => {
		const sorted = [{ duration: '900' }, { duration: '10000' }, { duration: '7200' }].sort(byDurationDesc);
		expect(sorted.map(({ duration }) => duration)).toEqual(['10000', '7200', '900']);
	});
});

import * as moment from 'moment';

const mockDatabase = { storesUtc: false };

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isSqlite: () => mockDatabase.storesUtc,
	isBetterSqlite3: () => false
}));

import { storedDayStart } from './daily-plan-stored-day';
import { planDatesAroundToday, planDatesOfDay } from '../../time-tracking/timer/timer-plan-rule';

/**
 * PostgreSQL and MySQL store a plan date in the API process's local time, SQLite in UTC. The bounds of a plan-day
 * lookup follow the same rule, or a plan stored at local midnight on the first day falls below them. Ever Teams sends
 * a plan day as a date, parsed as UTC midnight, so the timer's window holds that reading too. The expected local
 * values are computed in the zone the tests run in, so the rule is checked whatever that zone is.
 */
describe('stored plan day bounds', () => {
	const now = moment.utc('2026-11-05T21:30:00Z');
	const localMidnight = (day: string) => moment(day, 'YYYY-MM-DD').toDate();
	const utcMidnight = (day: string) => moment.utc(day, 'YYYY-MM-DD').toDate();
	const bothMidnightsOf = (day: string) => [utcMidnight(day).getTime(), localMidnight(day).getTime()];

	afterEach(() => {
		mockDatabase.storesUtc = false;
	});

	it('start at local midnight where the database stores local time', () => {
		const earliestFirstDayStart = Math.min(...bothMidnightsOf('2026-11-04'));
		const latestDayAfterWindowStart = Math.max(...bothMidnightsOf('2026-11-07'));

		expect(storedDayStart('2026-11-04')).toEqual(localMidnight('2026-11-04'));
		expect(planDatesAroundToday(now)).toEqual({
			from: new Date(earliestFirstDayStart),
			to: new Date(latestDayAfterWindowStart - 1)
		});
	});

	it('keep the plans of the day before and the day after, sent as dates or as local times', () => {
		const { from, to } = planDatesAroundToday(now);

		for (const firstDayStart of bothMidnightsOf('2026-11-04')) {
			expect(from.getTime()).toBeLessThanOrEqual(firstDayStart);
		}
		for (const lastDayStart of bothMidnightsOf('2026-11-06')) {
			expect(to.getTime()).toBeGreaterThanOrEqual(lastDayStart);
		}
	});

	it('start at UTC midnight on SQLite', () => {
		mockDatabase.storesUtc = true;

		const { from, to } = planDatesAroundToday(now);
		expect(from.toISOString()).toBe('2026-11-04T00:00:00.000Z');
		expect(to.toISOString()).toBe('2026-11-06T23:59:59.999Z');
	});

	it.each([false, true])('keep the plan of a named day and no other day (SQLite: %s)', (storesUtc) => {
		mockDatabase.storesUtc = storesUtc;
		const planDateOf = (day: string) => moment.utc(day, 'YYYY-MM-DD').valueOf();

		const { from, to } = planDatesOfDay('2026-11-05');
		const holds = (time: number) => time >= from.getTime() && time <= to.getTime();

		expect(holds(planDateOf('2026-11-05'))).toBe(true);
		expect(holds(planDateOf('2026-11-04'))).toBe(false);
		expect(holds(planDateOf('2026-11-06'))).toBe(false);
	});
});

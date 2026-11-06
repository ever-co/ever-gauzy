import * as moment from 'moment';

/**
 * PostgreSQL and MySQL store a plan date in the API process's local time. Each case runs as if the process were
 * `offsetHours` from UTC, whatever zone the suite itself runs in.
 */
const mockProcessZone = { offsetHours: 0 };

jest.mock('../../tasks/daily-plan/daily-plan-stored-day', () => {
	const actualMoment = jest.requireActual('moment');
	const HOUR_MS = 60 * 60 * 1000;
	return {
		storedDayStart: (day: string) => {
			const utcMidnight = actualMoment.utc(day, 'YYYY-MM-DD').valueOf();
			const offsetMs = mockProcessZone.offsetHours * HOUR_MS;
			return new Date(utcMidnight - offsetMs);
		}
	};
});

import { storedDayStart } from '../../tasks/daily-plan/daily-plan-stored-day';
import { planDatesOfDay } from './timer-plan-rule';

/** A plan for `day` as Ever Teams creates it: a date, parsed as UTC midnight. */
const sentAsDate = (day: string) => moment.utc(day, 'YYYY-MM-DD').valueOf();

/** A plan for `day` sent as a local date-time, which lands on the process's midnight. */
const sentAsLocalTime = (day: string) => storedDayStart(day).getTime();

describe('planDatesOfDay', () => {
	afterEach(() => {
		mockProcessZone.offsetHours = 0;
	});

	it.each([-11, -5, 0, 3, 14])(
		'keeps both readings of the named day and neither reading of the next or previous day, %s h from UTC',
		(offsetHours) => {
			mockProcessZone.offsetHours = offsetHours;
			const { from, to } = planDatesOfDay('2026-11-05');
			const holds = (time: number) => time >= from.getTime() && time <= to.getTime();

			for (const planDateOf of [sentAsDate, sentAsLocalTime]) {
				expect(holds(planDateOf('2026-11-05'))).toBe(true);
				expect(holds(planDateOf('2026-11-04'))).toBe(false);
				expect(holds(planDateOf('2026-11-06'))).toBe(false);
			}
		}
	);
});

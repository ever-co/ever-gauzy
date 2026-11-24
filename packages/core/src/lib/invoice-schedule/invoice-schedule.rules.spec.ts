import { InvoiceScheduleFrequencyEnum } from '@gauzy/contracts';
import {
	addMonthsToDay,
	duePeriodOf,
	firstPeriodRunAfter,
	INVOICE_SCHEDULE_CATCH_UP_DAYS,
	isRealDay,
	lastRunPeriodBy,
	nextPeriodOf,
	periodAt
} from './invoice-schedule.rules';

const monthly = { frequency: InvoiceScheduleFrequencyEnum.MONTHLY, startDay: '2026-10-01' };
const weekly = { frequency: InvoiceScheduleFrequencyEnum.WEEKLY, startDay: '2026-11-02' };
const biweekly = { frequency: InvoiceScheduleFrequencyEnum.BIWEEKLY, startDay: '2026-11-02' };

const never = () => false;

describe('invoice schedule periods', () => {
	it('tells a real day from a text that only looks like one', () => {
		expect(isRealDay('2026-02-28')).toBe(true);
		expect(isRealDay('2028-02-29')).toBe(true);
		expect(isRealDay('2026-02-29')).toBe(false);
		expect(isRealDay('2026-2-28')).toBe(false);
		expect(isRealDay('2026-02-28T00:00:00Z')).toBe(false);
		expect(isRealDay(null)).toBe(false);
	});

	it('adds months to a day, keeping it in a shorter month', () => {
		expect(addMonthsToDay('2026-01-31', 1)).toBe('2026-02-28');
		expect(addMonthsToDay('2026-01-31', 2)).toBe('2026-03-31');
		expect(addMonthsToDay('2026-12-15', 1)).toBe('2027-01-15');
		expect(addMonthsToDay('2028-01-30', 1)).toBe('2028-02-29');
	});

	it('bills a month from its first day to its last, on the first day of the next month', () => {
		expect(periodAt(monthly, 0)).toEqual({
			index: 0,
			startDay: '2026-10-01',
			endDay: '2026-10-31',
			runDay: '2026-11-01'
		});
		expect(periodAt(monthly, 2)).toEqual({
			index: 2,
			startDay: '2026-12-01',
			endDay: '2026-12-31',
			runDay: '2027-01-01'
		});
	});

	it('keeps a schedule started on the 31st on month ends, without drifting', () => {
		const fromMonthEnd = { frequency: InvoiceScheduleFrequencyEnum.MONTHLY, startDay: '2026-01-31' };

		expect(periodAt(fromMonthEnd, 0)).toMatchObject({ startDay: '2026-01-31', endDay: '2026-02-27' });
		expect(periodAt(fromMonthEnd, 1)).toMatchObject({ startDay: '2026-02-28', endDay: '2026-03-30' });
		expect(periodAt(fromMonthEnd, 2)).toMatchObject({ startDay: '2026-03-31', endDay: '2026-04-29' });
	});

	it('bills a week or two weeks, the day after each ends', () => {
		expect(periodAt(weekly, 1)).toMatchObject({
			startDay: '2026-11-09',
			endDay: '2026-11-15',
			runDay: '2026-11-16'
		});
		expect(periodAt(biweekly, 1)).toMatchObject({
			startDay: '2026-11-16',
			endDay: '2026-11-29',
			runDay: '2026-11-30'
		});
	});

	it('finds the last period whose run day has come, that day included', () => {
		expect(lastRunPeriodBy(monthly, '2026-10-31')).toBeNull();
		expect(lastRunPeriodBy(monthly, '2026-11-01')).toMatchObject({ startDay: '2026-10-01', endDay: '2026-10-31' });
		expect(lastRunPeriodBy(monthly, '2026-11-30')).toMatchObject({ startDay: '2026-10-01' });
		expect(lastRunPeriodBy(monthly, '2027-03-02')).toMatchObject({ startDay: '2027-02-01', endDay: '2027-02-28' });

		expect(lastRunPeriodBy(weekly, '2026-11-08')).toBeNull();
		expect(lastRunPeriodBy(weekly, '2026-11-09')).toMatchObject({ startDay: '2026-11-02', endDay: '2026-11-08' });
		expect(lastRunPeriodBy(weekly, '2026-11-15')).toMatchObject({ startDay: '2026-11-02' });
	});

	it('finds the first period still ahead, also before the start day', () => {
		expect(firstPeriodRunAfter(monthly, '2026-09-15')).toMatchObject({ index: 0, runDay: '2026-11-01' });
		expect(firstPeriodRunAfter(monthly, '2026-11-01')).toMatchObject({ index: 1, runDay: '2026-12-01' });
		expect(firstPeriodRunAfter(weekly, '2026-11-09')).toMatchObject({ index: 1, runDay: '2026-11-16' });
	});
});

describe('the period due today', () => {
	it('is October on the first of November, for a schedule that ran by then', () => {
		expect(duePeriodOf(monthly, '2026-11-01', '2026-10-01')).toMatchObject({
			startDay: '2026-10-01',
			endDay: '2026-10-31'
		});
	});

	it('is still October a few days later, to catch up a sweep that did not run, then no longer', () => {
		const lastCatchUpDay = `2026-11-0${1 + INVOICE_SCHEDULE_CATCH_UP_DAYS}`;

		expect(duePeriodOf(monthly, lastCatchUpDay, '2026-10-01')).toMatchObject({ startDay: '2026-10-01' });
		expect(duePeriodOf(monthly, '2026-11-09', '2026-10-01')).toBeNull();
	});

	it('is none whose run day came before the schedule ran: creating or resuming it never bills the past', () => {
		// Created on 2 November with a start day in October: October's run day, 1 November, is before it
		expect(duePeriodOf(monthly, '2026-11-02', '2026-11-02')).toBeNull();
		// Created on the run day itself: that day's period is billed
		expect(duePeriodOf(monthly, '2026-11-01', '2026-11-01')).toMatchObject({ startDay: '2026-10-01' });
	});

	it('is only the last one, never the periods before it, for a start day far in the past', () => {
		const longAgo = { frequency: InvoiceScheduleFrequencyEnum.WEEKLY, startDay: '2025-01-06' };

		const due = duePeriodOf(longAgo, '2026-11-16', '2025-01-01');

		expect(due).toMatchObject({ startDay: '2026-11-09', endDay: '2026-11-15', runDay: '2026-11-16' });
	});
});

describe('the next period', () => {
	it('is the one due today while it is not billed, then the one after it', () => {
		expect(nextPeriodOf(monthly, '2026-11-01', '2026-10-01', never)).toMatchObject({ startDay: '2026-10-01' });

		const billed = (start: string) => start === '2026-10-01';
		expect(nextPeriodOf(monthly, '2026-11-01', '2026-10-01', billed)).toMatchObject({
			startDay: '2026-11-01',
			runDay: '2026-12-01'
		});
	});

	it('is the first one ahead for a schedule created after the last run day', () => {
		expect(nextPeriodOf(monthly, '2026-11-02', '2026-11-02', never)).toMatchObject({
			startDay: '2026-11-01',
			endDay: '2026-11-30',
			runDay: '2026-12-01'
		});
	});

	it('is the first period for a schedule that starts later', () => {
		expect(nextPeriodOf(monthly, '2026-09-20', '2026-09-20', never)).toMatchObject({
			startDay: '2026-10-01',
			runDay: '2026-11-01'
		});
	});
});

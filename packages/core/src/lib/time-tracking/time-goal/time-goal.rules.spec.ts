import { TimeGoalComparisonEnum, TimeGoalPeriodEnum, TimeGoalStateEnum, WeekDaysEnum } from '@gauzy/contracts';
import {
	isTargetWithinPeriod,
	maxHoursOfPeriod,
	periodRangeOf,
	stateOf,
	targetSecondsOf,
	todayIn,
	TimeGoalCountedLog,
	trackedSecondsOf
} from './time-goal.rules';

const HOUR = 3600;

describe('time goal rules', () => {
	describe('stateOf', () => {
		it.each([
			[TimeGoalComparisonEnum.AT_LEAST, 12 * HOUR, 20 * HOUR, TimeGoalStateEnum.IN_PROGRESS],
			[TimeGoalComparisonEnum.AT_LEAST, 20 * HOUR, 20 * HOUR, TimeGoalStateEnum.ACHIEVED],
			[TimeGoalComparisonEnum.AT_LEAST, 21 * HOUR, 20 * HOUR, TimeGoalStateEnum.ACHIEVED],
			[TimeGoalComparisonEnum.AT_MOST, 1 * HOUR, 2 * HOUR, TimeGoalStateEnum.ON_TRACK],
			[TimeGoalComparisonEnum.AT_MOST, 2 * HOUR, 2 * HOUR, TimeGoalStateEnum.ON_TRACK],
			[TimeGoalComparisonEnum.AT_MOST, 2.5 * HOUR, 2 * HOUR, TimeGoalStateEnum.EXCEEDED]
		])('%s with %i s tracked of %i s is %s', (comparison, tracked, target, expected) => {
			expect(stateOf(comparison, tracked, target)).toBe(expected);
		});
	});

	describe('targetSecondsOf', () => {
		it.each([
			[20, 72000],
			[2.5, 9000],
			[7.75, 27900],
			[0.01, 36]
		])('%d hours are %d seconds', (hours, seconds) => {
			expect(targetSecondsOf(hours)).toBe(seconds);
		});
	});

	describe('maxHoursOfPeriod and isTargetWithinPeriod', () => {
		it('allows a day, a week and a month of hours', () => {
			expect(maxHoursOfPeriod(TimeGoalPeriodEnum.DAY)).toBe(24);
			expect(maxHoursOfPeriod(TimeGoalPeriodEnum.WEEK)).toBe(168);
			expect(maxHoursOfPeriod(TimeGoalPeriodEnum.MONTH)).toBe(744);
		});

		it('refuses more hours than the period holds', () => {
			expect(isTargetWithinPeriod(TimeGoalPeriodEnum.DAY, 24)).toBe(true);
			expect(isTargetWithinPeriod(TimeGoalPeriodEnum.DAY, 24.5)).toBe(false);
			expect(isTargetWithinPeriod(TimeGoalPeriodEnum.WEEK, 168)).toBe(true);
			expect(isTargetWithinPeriod(TimeGoalPeriodEnum.WEEK, 169)).toBe(false);
		});
	});

	describe('periodRangeOf', () => {
		it('counts a day from midnight to midnight in the time zone', () => {
			const range = periodRangeOf(TimeGoalPeriodEnum.DAY, '2026-11-10', 'Africa/Kinshasa', WeekDaysEnum.MONDAY);

			expect(range.start.toISOString()).toBe('2026-11-09T23:00:00.000Z');
			expect(range.end.toISOString()).toBe('2026-11-10T23:00:00.000Z');
			expect(range.startDate).toBe('2026-11-10');
			expect(range.endDate).toBe('2026-11-10');
		});

		it('keeps a 25-hour day whole when the clocks go back', () => {
			const range = periodRangeOf(TimeGoalPeriodEnum.DAY, '2026-11-01', 'America/New_York', WeekDaysEnum.MONDAY);

			expect(range.start.toISOString()).toBe('2026-11-01T04:00:00.000Z');
			expect(range.end.toISOString()).toBe('2026-11-02T05:00:00.000Z');
		});

		it('starts a week on the organization week start', () => {
			const monday = periodRangeOf(TimeGoalPeriodEnum.WEEK, '2026-11-11', 'UTC', WeekDaysEnum.MONDAY);
			expect(monday.startDate).toBe('2026-11-09');
			expect(monday.endDate).toBe('2026-11-15');
			expect(monday.start.toISOString()).toBe('2026-11-09T00:00:00.000Z');
			expect(monday.end.toISOString()).toBe('2026-11-16T00:00:00.000Z');

			const sunday = periodRangeOf(TimeGoalPeriodEnum.WEEK, '2026-11-11', 'UTC', WeekDaysEnum.SUNDAY);
			expect(sunday.startDate).toBe('2026-11-08');
			expect(sunday.endDate).toBe('2026-11-14');

			const saturday = periodRangeOf(TimeGoalPeriodEnum.WEEK, '2026-11-11', 'UTC', WeekDaysEnum.SATURDAY);
			expect(saturday.startDate).toBe('2026-11-07');
			expect(saturday.endDate).toBe('2026-11-13');
		});

		it('reads the week start day itself as the first day of its week', () => {
			const range = periodRangeOf(TimeGoalPeriodEnum.WEEK, '2026-11-09', 'UTC', WeekDaysEnum.MONDAY);

			expect(range.startDate).toBe('2026-11-09');
			expect(range.endDate).toBe('2026-11-15');
		});

		it('starts the week on Monday when the organization names no week start', () => {
			const range = periodRangeOf(TimeGoalPeriodEnum.WEEK, '2026-11-11', 'UTC', null);

			expect(range.startDate).toBe('2026-11-09');
		});

		it('counts a calendar month', () => {
			const range = periodRangeOf(TimeGoalPeriodEnum.MONTH, '2026-11-11', 'Africa/Kinshasa', WeekDaysEnum.MONDAY);

			expect(range.startDate).toBe('2026-11-01');
			expect(range.endDate).toBe('2026-11-30');
			expect(range.start.toISOString()).toBe('2026-10-31T23:00:00.000Z');
			expect(range.end.toISOString()).toBe('2026-11-30T23:00:00.000Z');
		});
	});

	describe('todayIn', () => {
		it('reads the calendar date of the instant in the time zone', () => {
			const now = new Date('2026-11-10T23:30:00.000Z');

			expect(todayIn('UTC', now)).toBe('2026-11-10');
			expect(todayIn('Africa/Kinshasa', now)).toBe('2026-11-11');
		});
	});

	describe('trackedSecondsOf', () => {
		const range = periodRangeOf(TimeGoalPeriodEnum.DAY, '2026-11-10', 'UTC', WeekDaysEnum.MONDAY);
		const now = new Date('2026-11-10T18:00:00.000Z');
		const at = (time: string) => new Date(`2026-11-10T${time}:00.000Z`);
		const log = (overrides: Partial<TimeGoalCountedLog>): TimeGoalCountedLog => ({
			startedAt: at('09:00'),
			stoppedAt: at('10:00'),
			isBillable: true,
			projectId: 'meetings',
			organizationContactId: null,
			projectOrganizationContactId: null,
			...overrides
		});

		it('adds the logs that start in the period', () => {
			const logs = [
				log({}),
				log({ startedAt: at('11:00'), stoppedAt: at('12:30') }),
				log({ startedAt: new Date('2026-11-09T23:00:00.000Z'), stoppedAt: at('01:00') })
			];

			expect(trackedSecondsOf(logs, {}, range, now)).toBe(2.5 * HOUR);
		});

		it('counts a running log up to now', () => {
			expect(trackedSecondsOf([log({ startedAt: at('16:00'), stoppedAt: null })], {}, range, now)).toBe(2 * HOUR);
		});

		it('never counts a log that stops before it starts', () => {
			expect(trackedSecondsOf([log({ startedAt: at('10:00'), stoppedAt: at('09:00') })], {}, range, now)).toBe(0);
		});

		it('counts billable time only when the goal says so', () => {
			const logs = [log({}), log({ startedAt: at('11:00'), stoppedAt: at('12:00'), isBillable: false })];

			expect(trackedSecondsOf(logs, {}, range, now)).toBe(2 * HOUR);
			expect(trackedSecondsOf(logs, { billableOnly: true }, range, now)).toBe(1 * HOUR);
		});

		it('counts the projects of the goal only', () => {
			const logs = [log({}), log({ startedAt: at('11:00'), stoppedAt: at('12:00'), projectId: 'website' })];

			expect(trackedSecondsOf(logs, { projectIds: ['website'] }, range, now)).toBe(1 * HOUR);
		});

		it("counts a client's time on its projects and on the log itself", () => {
			const logs = [
				log({ projectOrganizationContactId: 'client-a' }),
				log({
					startedAt: at('11:00'),
					stoppedAt: at('12:00'),
					organizationContactId: 'client-a',
					projectId: null
				}),
				log({ startedAt: at('13:00'), stoppedAt: at('14:00'), projectOrganizationContactId: 'client-b' })
			];

			expect(trackedSecondsOf(logs, { organizationContactIds: ['client-a'] }, range, now)).toBe(2 * HOUR);
		});

		it('counts a log that matches every filter of the goal', () => {
			const logs = [
				log({ projectId: 'website', projectOrganizationContactId: 'client-a' }),
				log({
					startedAt: at('11:00'),
					stoppedAt: at('12:00'),
					projectId: 'meetings',
					projectOrganizationContactId: 'client-a'
				})
			];
			const filter = { projectIds: ['website'], organizationContactIds: ['client-a'] };

			expect(trackedSecondsOf(logs, filter, range, now)).toBe(1 * HOUR);
		});
	});
});

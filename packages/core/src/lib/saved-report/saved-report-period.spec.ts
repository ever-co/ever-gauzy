import { SavedReportPeriodRuleEnum, WeekDaysEnum } from '@gauzy/contracts';
import { fixedDaysCount, resolveSavedReportPeriod, savedReportTimeZoneOf, weekStartDayOf } from './saved-report-period';

const KINSHASA = 'Africa/Kinshasa';
const MONDAY = weekStartDayOf(WeekDaysEnum.MONDAY);
const SUNDAY = weekStartDayOf(WeekDaysEnum.SUNDAY);

/** The days of a rule read at `now` in Kinshasa, weeks starting on `weekStartsOn`. */
function daysOf(periodRule: SavedReportPeriodRuleEnum, now: string, weekStartsOn = MONDAY) {
	const period = resolveSavedReportPeriod({ periodRule, timeZone: KINSHASA }, weekStartsOn, new Date(now));
	return [period?.startDate, period?.endDate];
}

describe('resolveSavedReportPeriod', () => {
	it('moves "last month" with the calendar: saved on 3 November, read on 2 December, it covers November', () => {
		expect(daysOf(SavedReportPeriodRuleEnum.LAST_MONTH, '2026-11-03T09:00:00Z')).toEqual([
			'2026-10-01',
			'2026-10-31'
		]);
		expect(daysOf(SavedReportPeriodRuleEnum.LAST_MONTH, '2026-12-02T09:00:00Z')).toEqual([
			'2026-11-01',
			'2026-11-30'
		]);
	});

	it('bounds the days at the zone midnights, as the report page sends them', () => {
		const period = resolveSavedReportPeriod(
			{ periodRule: SavedReportPeriodRuleEnum.LAST_MONTH, timeZone: KINSHASA },
			MONDAY,
			new Date('2026-12-02T09:00:00Z')
		);
		expect(period?.start.toISOString()).toBe('2026-10-31T23:00:00.000Z');
		expect(period?.end.toISOString()).toBe('2026-11-30T22:59:59.999Z');
		expect(period?.timeZone).toBe(KINSHASA);
	});

	it('reads the day in the report zone: 23:30 UTC on 30 November is already December in Kinshasa', () => {
		const now = new Date('2026-11-30T23:30:00Z');
		const inKinshasa = resolveSavedReportPeriod(
			{ periodRule: SavedReportPeriodRuleEnum.THIS_MONTH, timeZone: KINSHASA },
			MONDAY,
			now
		);
		const inUtc = resolveSavedReportPeriod(
			{ periodRule: SavedReportPeriodRuleEnum.THIS_MONTH, timeZone: 'UTC' },
			MONDAY,
			now
		);
		expect([inKinshasa?.startDate, inKinshasa?.endDate]).toEqual(['2026-12-01', '2026-12-31']);
		expect([inUtc?.startDate, inUtc?.endDate]).toEqual(['2026-11-01', '2026-11-30']);
	});

	it('starts weeks on the organization day: Wednesday 11 November is in 9-15 from Monday, 8-14 from Sunday', () => {
		const wednesday = '2026-11-11T12:00:00Z';
		expect(daysOf(SavedReportPeriodRuleEnum.THIS_WEEK, wednesday, MONDAY)).toEqual(['2026-11-09', '2026-11-15']);
		expect(daysOf(SavedReportPeriodRuleEnum.THIS_WEEK, wednesday, SUNDAY)).toEqual(['2026-11-08', '2026-11-14']);
		expect(daysOf(SavedReportPeriodRuleEnum.LAST_WEEK, wednesday, MONDAY)).toEqual(['2026-11-02', '2026-11-08']);
		expect(daysOf(SavedReportPeriodRuleEnum.LAST_WEEK, wednesday, SUNDAY)).toEqual(['2026-11-01', '2026-11-07']);
	});

	it('counts the rolling rules back from the reading day, which they include', () => {
		const now = '2026-11-11T12:00:00Z';
		expect(daysOf(SavedReportPeriodRuleEnum.TODAY, now)).toEqual(['2026-11-11', '2026-11-11']);
		expect(daysOf(SavedReportPeriodRuleEnum.YESTERDAY, now)).toEqual(['2026-11-10', '2026-11-10']);
		expect(daysOf(SavedReportPeriodRuleEnum.LAST_7_DAYS, now)).toEqual(['2026-11-05', '2026-11-11']);
		expect(daysOf(SavedReportPeriodRuleEnum.LAST_14_DAYS, now)).toEqual(['2026-10-29', '2026-11-11']);
		expect(daysOf(SavedReportPeriodRuleEnum.THIS_MONTH, now)).toEqual(['2026-11-01', '2026-11-30']);
	});

	it('keeps fixed days fixed, whatever the reading day', () => {
		const period = resolveSavedReportPeriod(
			{ startDate: '2026-10-05', endDate: '2026-10-09', timeZone: KINSHASA },
			MONDAY,
			new Date('2027-03-01T00:00:00Z')
		);
		expect([period?.startDate, period?.endDate]).toEqual(['2026-10-05', '2026-10-09']);
		expect(period?.start.toISOString()).toBe('2026-10-04T23:00:00.000Z');
		expect(period?.end.toISOString()).toBe('2026-10-09T22:59:59.999Z');
	});

	it('answers null for days in the wrong order, a day that does not exist, or neither a rule nor days', () => {
		const now = new Date('2026-11-11T12:00:00Z');
		expect(resolveSavedReportPeriod({ startDate: '2026-10-09', endDate: '2026-10-05' }, MONDAY, now)).toBeNull();
		expect(resolveSavedReportPeriod({ startDate: '2026-02-30', endDate: '2026-03-02' }, MONDAY, now)).toBeNull();
		expect(resolveSavedReportPeriod({ startDate: '2026-10-05' }, MONDAY, now)).toBeNull();
		expect(resolveSavedReportPeriod({}, MONDAY, now)).toBeNull();
	});

	it('counts the days of a report without a known zone in UTC', () => {
		expect(savedReportTimeZoneOf('Mars/Olympus_Mons')).toBe('UTC');
		expect(savedReportTimeZoneOf(null)).toBe('UTC');
		expect(savedReportTimeZoneOf(KINSHASA)).toBe(KINSHASA);
	});
});

describe('weekStartDayOf', () => {
	it('reads the organization day, Monday when it has none', () => {
		expect(weekStartDayOf(WeekDaysEnum.SUNDAY)).toBe(0);
		expect(weekStartDayOf(WeekDaysEnum.SATURDAY)).toBe(6);
		expect(weekStartDayOf(undefined)).toBe(1);
		expect(weekStartDayOf('NOT_A_DAY')).toBe(1);
	});
});

describe('fixedDaysCount', () => {
	it('counts both ends, and refuses days in the wrong order', () => {
		expect(fixedDaysCount('2026-01-01', '2026-12-31')).toBe(365);
		expect(fixedDaysCount('2026-10-05', '2026-10-05')).toBe(1);
		expect(fixedDaysCount('2026-10-09', '2026-10-05')).toBeNull();
		expect(fixedDaysCount('2026-13-01', '2026-12-01')).toBeNull();
	});
});

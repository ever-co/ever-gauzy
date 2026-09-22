import * as moment from 'moment';
import type { IOrganization } from '@gauzy/contracts';
import type { IDashboardWidgetContext } from '@gauzy/ui-core/core';
import {
	isCurrentWeekRange,
	isMoreThanWeekRange,
	rangeMessageKey,
	RangePeriod,
	resolvePeriodSeconds,
	resolveRangePeriod,
	timeTrackScopeKey,
	toErrorMessage,
	toWeekHourBars
} from './time-track-widget.utils';

/**
 * Builds a minimal widget context for the pure helpers under test.
 */
function createContext(overrides: Partial<IDashboardWidgetContext> = {}): IDashboardWidgetContext {
	return {
		tenantId: 'tenant-1',
		organizationId: 'org-1',
		startDate: new Date('2026-07-20T00:00:00Z'),
		endDate: new Date('2026-07-26T23:59:59Z'),
		todayStart: new Date('2026-07-26T00:00:00Z'),
		todayEnd: new Date('2026-07-26T23:59:59Z'),
		timeZone: 'UTC',
		...overrides
	} as IDashboardWidgetContext;
}

describe('time-track widget utils', () => {
	describe('resolveRangePeriod', () => {
		it('classifies a single day', () => {
			const day = new Date('2026-07-26T00:00:00Z');
			expect(resolveRangePeriod(createContext({ startDate: day, endDate: day }))).toBe(RangePeriod.DAY);
		});

		it('classifies a seven day span as a week', () => {
			expect(resolveRangePeriod(createContext())).toBe(RangePeriod.WEEK);
		});

		it('classifies anything else as a period', () => {
			const context = createContext({ endDate: new Date('2026-08-19T23:59:59Z') });
			expect(resolveRangePeriod(context)).toBe(RangePeriod.PERIOD);
		});

		it('defaults to week without a range', () => {
			expect(resolveRangePeriod(null)).toBe(RangePeriod.WEEK);
		});
	});

	describe('isCurrentWeekRange', () => {
		it('detects the current calendar week', () => {
			const context = createContext({
				startDate: moment().startOf('week').toDate(),
				endDate: moment().endOf('week').toDate()
			});
			expect(isCurrentWeekRange(context)).toBe(true);
		});

		it('rejects a past week', () => {
			const context = createContext({
				startDate: moment().subtract(3, 'weeks').startOf('week').toDate(),
				endDate: moment().subtract(3, 'weeks').endOf('week').toDate()
			});
			expect(isCurrentWeekRange(context)).toBe(false);
		});
	});

	describe('resolvePeriodSeconds', () => {
		it('uses the organization working hours', () => {
			const context = createContext({
				organization: { defaultStartTime: '09:00', defaultEndTime: '17:00' } as unknown as IOrganization
			});
			// 7 days * 8h * 3 members
			expect(resolvePeriodSeconds(context, 3)).toBe(7 * 28800 * 3);
		});

		it('falls back to a full day when working hours are not configured', () => {
			expect(resolvePeriodSeconds(createContext(), 2)).toBe(7 * 86400 * 2);
		});

		it('falls back to a full day when only one end of the working day is set', () => {
			const context = createContext({
				organization: { defaultStartTime: '09:00' } as unknown as IOrganization
			});
			expect(resolvePeriodSeconds(context, 2)).toBe(7 * 86400 * 2);
		});

		it('falls back to a full day when the working hours do not parse', () => {
			const context = createContext({
				organization: { defaultStartTime: 'nonsense', defaultEndTime: '17:00' } as unknown as IOrganization
			});
			expect(resolvePeriodSeconds(context, 1)).toBe(7 * 86400);
		});

		it('is zero without a range', () => {
			expect(resolvePeriodSeconds(null, 5)).toBe(0);
		});
	});

	describe('toErrorMessage', () => {
		it('returns null when there is no error', () => {
			expect(toErrorMessage(null)).toBeNull();
		});

		it('passes strings through', () => {
			expect(toErrorMessage('boom')).toBe('boom');
		});

		it('unwraps an error message', () => {
			expect(toErrorMessage(new Error('request failed'))).toBe('request failed');
		});

		it('prefers the nested API message of an HttpErrorResponse', () => {
			const response = { message: 'Http failure response', error: { message: 'Organization not found' } };
			expect(toErrorMessage(response)).toBe('Organization not found');
		});

		it('never renders a bare object as [object Object]', () => {
			expect(toErrorMessage({ status: 500 })).toBe('Something went wrong');
		});
	});

	describe('isMoreThanWeekRange', () => {
		it('accepts a single week', () => {
			expect(isMoreThanWeekRange(createContext())).toBe(false);
		});

		it('detects a longer range', () => {
			expect(isMoreThanWeekRange(createContext({ endDate: new Date('2026-08-19T23:59:59Z') }))).toBe(true);
		});

		it('is false without a range', () => {
			expect(isMoreThanWeekRange(null)).toBe(false);
		});
	});

	describe('rangeMessageKey', () => {
		it('suffixes the base key with the range', () => {
			expect(rangeMessageKey('TIMESHEET.NO_MANUAL_TIME', RangePeriod.PERIOD)).toBe(
				'TIMESHEET.NO_MANUAL_TIME_PERIOD'
			);
		});
	});

	describe('timeTrackScopeKey', () => {
		it('is stable across two equal contexts', () => {
			expect(timeTrackScopeKey(createContext())).toBe(timeTrackScopeKey(createContext()));
		});

		it('changes when the range changes', () => {
			const other = createContext({ endDate: new Date('2026-07-27T23:59:59Z') });
			expect(timeTrackScopeKey(other)).not.toBe(timeTrackScopeKey(createContext()));
		});

		it('ignores fields the request does not carry', () => {
			// A new `organization` object identity (or a currency switch) must not
			// look like a different request, or every store write refetches.
			const noisy = createContext({
				currency: 'EUR',
				organization: { defaultStartTime: '09:00' } as unknown as IOrganization
			});
			expect(timeTrackScopeKey(noisy)).toBe(timeTrackScopeKey(createContext()));
		});

		it('survives a bookmark-restored context whose dates are ISO strings', () => {
			const serialized = createContext({
				startDate: '2026-07-20T00:00:00Z' as unknown as Date,
				endDate: '2026-07-26T23:59:59Z' as unknown as Date
			});
			expect(() => timeTrackScopeKey(serialized)).not.toThrow();
			expect(timeTrackScopeKey(serialized)).toBe(timeTrackScopeKey(createContext()));
		});

		it('is empty without a context', () => {
			expect(timeTrackScopeKey(null)).toBe('');
		});
	});

	describe('toWeekHourBars', () => {
		it('always returns seven bars', () => {
			expect(toWeekHourBars([{ day: 1, duration: 3600 }])).toHaveLength(7);
		});

		it('expresses each day as a share of the member week', () => {
			const bars = toWeekHourBars([
				{ day: 1, duration: 3600 },
				{ day: 3, duration: 1200 }
			]);
			expect(bars[1].duration).toBeCloseTo(75);
			expect(bars[3].duration).toBeCloseTo(25);
			expect(bars[0].duration).toBe(0);
		});

		it('coerces string durations rather than mixing parsers', () => {
			const bars = toWeekHourBars([
				{ day: 0, duration: '30' as unknown as number },
				{ day: 1, duration: '90' as unknown as number }
			]);
			expect(bars[0].duration).toBeCloseTo(25);
			expect(bars[1].duration).toBeCloseTo(75);
		});

		it('buckets string days, as better-sqlite3 and PostgreSQL return them', () => {
			const bars = toWeekHourBars([
				{ day: '1' as unknown as number, duration: '3600' as unknown as number },
				{ day: '3' as unknown as number, duration: '1200' as unknown as number }
			]);
			expect(bars[1].duration).toBeCloseTo(75);
			expect(bars[3].duration).toBeCloseTo(25);
		});

		it('drops days outside the week instead of shrinking every share', () => {
			const bars = toWeekHourBars([
				{ day: 2, duration: 100 },
				{ day: 9, duration: 100 },
				{ day: NaN, duration: 100 }
			]);
			expect(bars[2].duration).toBeCloseTo(100);
		});

		it('returns zeroed bars for an empty or missing week', () => {
			expect(toWeekHourBars(undefined).every((bar) => bar.duration === 0)).toBe(true);
			expect(toWeekHourBars([]).every((bar) => bar.duration === 0)).toBe(true);
		});
	});
});

import * as moment from 'moment';
import type { IOrganization } from '@gauzy/contracts';
import type { IDashboardWidgetContext } from '@gauzy/ui-core/core';
import {
	isCurrentWeekRange,
	RangePeriod,
	resolvePeriodSeconds,
	resolveRangePeriod,
	toErrorMessage
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
	});
});

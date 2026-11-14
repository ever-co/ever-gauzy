import { SavedReportPeriodRuleEnum } from '@gauzy/contracts';
import {
	isSavedReportLinkLive,
	nextSavedReportPeriodOf,
	savedReportPeriodProblemOf,
	shareExpiryProblemOf
} from './saved-report.rules';

describe('savedReportPeriodProblemOf', () => {
	it('accepts a rule alone, or two real days in order', () => {
		expect(savedReportPeriodProblemOf({ periodRule: SavedReportPeriodRuleEnum.LAST_MONTH })).toBeNull();
		expect(savedReportPeriodProblemOf({ startDate: '2026-10-01', endDate: '2026-10-31' })).toBeNull();
		expect(savedReportPeriodProblemOf({ startDate: '2026-10-01', endDate: '2026-10-01' })).toBeNull();
	});

	it('refuses both a rule and days, neither, one day only, days out of order and more than a year', () => {
		expect(
			savedReportPeriodProblemOf({
				periodRule: SavedReportPeriodRuleEnum.LAST_MONTH,
				startDate: '2026-10-01',
				endDate: '2026-10-31'
			})
		).toMatch(/not both/);
		expect(savedReportPeriodProblemOf({})).toMatch(/rule, or as a first and a last day/);
		expect(savedReportPeriodProblemOf({ startDate: '2026-10-01' })).toMatch(/first and a last day/);
		expect(savedReportPeriodProblemOf({ startDate: '2026-10-31', endDate: '2026-10-01' })).toMatch(/on or after/);
		expect(savedReportPeriodProblemOf({ startDate: '2026-02-30', endDate: '2026-03-01' })).toMatch(/real day/);
		expect(savedReportPeriodProblemOf({ startDate: '2025-01-01', endDate: '2026-01-02' })).toMatch(/at most 366/);
	});
});

describe('nextSavedReportPeriodOf', () => {
	const stored = { periodRule: SavedReportPeriodRuleEnum.LAST_MONTH, startDate: null, endDate: null };

	it('keeps what the update does not send', () => {
		expect(nextSavedReportPeriodOf(stored, {})).toEqual(stored);
	});

	it('switches to fixed days when the update clears the rule and sends days', () => {
		expect(
			nextSavedReportPeriodOf(stored, { periodRule: null, startDate: '2026-10-01', endDate: '2026-10-31' })
		).toEqual({
			periodRule: null,
			startDate: '2026-10-01',
			endDate: '2026-10-31'
		});
	});

	it('leaves both when the update sends days without clearing the rule, for the check to refuse', () => {
		const next = nextSavedReportPeriodOf(stored, { startDate: '2026-10-01', endDate: '2026-10-31' });

		expect(savedReportPeriodProblemOf(next)).toMatch(/not both/);
	});
});

describe('isSavedReportLinkLive', () => {
	const now = new Date('2026-11-13T12:00:00Z');

	it('is live when on and not expired', () => {
		expect(isSavedReportLinkLive({ shareTokenHash: 'a'.repeat(64), shareExpiresAt: null }, now)).toBe(true);
		expect(
			isSavedReportLinkLive(
				{ shareTokenHash: 'a'.repeat(64), shareExpiresAt: new Date('2026-11-14T00:00:00Z') },
				now
			)
		).toBe(true);
	});

	it('is dead when off or past its end', () => {
		expect(isSavedReportLinkLive({ shareTokenHash: null, shareExpiresAt: null }, now)).toBe(false);
		expect(isSavedReportLinkLive({ shareTokenHash: 'a'.repeat(64), shareExpiresAt: now }, now)).toBe(false);
	});
});

describe('shareExpiryProblemOf', () => {
	const now = new Date('2026-11-13T12:00:00Z');

	it('accepts no end, or an end ahead', () => {
		expect(shareExpiryProblemOf(undefined, now)).toBeNull();
		expect(shareExpiryProblemOf(null, now)).toBeNull();
		expect(shareExpiryProblemOf('2026-12-31T00:00:00Z', now)).toBeNull();
	});

	it('refuses an end that is past or not a date', () => {
		expect(shareExpiryProblemOf('2026-11-13T12:00:00Z', now)).toMatch(/future/);
		expect(shareExpiryProblemOf('not a date', now)).toMatch(/not a date/);
	});
});

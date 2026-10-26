/**
 * The agent captured screenshots on its local default and never read the organisation's screenshot frequency. These
 * helpers turn the organisation's value into the stored capture period and the period into the capture interval.
 */
import {
	DEFAULT_SCREENSHOT_INTERVAL_MINUTES,
	organizationScreenshotPeriod,
	parseScreenshotFrequency,
	resolveScreenshotIntervalSeconds
} from './screenshot-interval';

describe('screenshot interval', () => {
	describe('parseScreenshotFrequency', () => {
		it('accepts a positive number of minutes', () => {
			expect(parseScreenshotFrequency(3)).toBe(3);
			expect(parseScreenshotFrequency(10)).toBe(10);
		});

		it('accepts the string a numeric column arrives as', () => {
			expect(parseScreenshotFrequency('5')).toBe(5);
			expect(parseScreenshotFrequency('10.00')).toBe(10);
		});

		it('treats missing, empty, zero, negative and non-numeric values as unset', () => {
			for (const value of [undefined, null, '', '  ', 0, -5, '0', 'ten', Number.NaN, Infinity, {}, true]) {
				expect(parseScreenshotFrequency(value)).toBeNull();
			}
		});
	});

	describe('organizationScreenshotPeriod', () => {
		it("returns the organisation's frequency, whether or not the organisation enforces its settings", () => {
			const notEnforced = { screenshotFrequency: '1', enforced: false };
			const enforced = { screenshotFrequency: 10, enforced: true };
			expect(organizationScreenshotPeriod({ screenshotFrequency: 3 })).toBe(3);
			expect(organizationScreenshotPeriod(notEnforced)).toBe(1);
			expect(organizationScreenshotPeriod(enforced)).toBe(10);
		});

		it('returns null when the organisation has no usable frequency, so the current period stays', () => {
			expect(organizationScreenshotPeriod(null)).toBeNull();
			expect(organizationScreenshotPeriod(undefined)).toBeNull();
			expect(organizationScreenshotPeriod({})).toBeNull();
			expect(organizationScreenshotPeriod({ screenshotFrequency: null })).toBeNull();
			expect(organizationScreenshotPeriod({ screenshotFrequency: 0 })).toBeNull();
		});
	});

	describe('resolveScreenshotIntervalSeconds', () => {
		it('uses the stored period, in seconds', () => {
			expect(resolveScreenshotIntervalSeconds({ timer: { updatePeriod: 3 } })).toBe(180);
			expect(resolveScreenshotIntervalSeconds({ timer: { updatePeriod: '10' } })).toBe(600);
		});

		it('falls back to the default only when no period is stored', () => {
			const fallback = DEFAULT_SCREENSHOT_INTERVAL_MINUTES * 60;
			expect(fallback).toBe(300);
			expect(resolveScreenshotIntervalSeconds(undefined)).toBe(fallback);
			expect(resolveScreenshotIntervalSeconds({})).toBe(fallback);
			expect(resolveScreenshotIntervalSeconds({ timer: {} })).toBe(fallback);
			expect(resolveScreenshotIntervalSeconds({ timer: { updatePeriod: null } })).toBe(fallback);
		});
	});
});

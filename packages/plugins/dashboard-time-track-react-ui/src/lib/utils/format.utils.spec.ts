import { TimeFormatEnum } from '@gauzy/contracts';

/*
 * `@gauzy/ui-core/common` is an Angular barrel; `toTimezone` (the only import) is re-declared with
 * its real one-line body (`shared-utils.ts#toTimezone`).
 */
jest.mock('@gauzy/ui-core/common', () => {
	const m = jest.requireActual('moment-timezone');
	return { toTimezone: (date: unknown, timezone: string) => m.utc(date as string).tz(timezone) };
});

import { dateFormat, durationFormat, durationMinutesLabel, reportDateParam, timeFormat, utcToTimezone } from './format.utils';

describe('format.utils — pipe parity', () => {
	it('durationFormat truncates like the `durationFormat` pipe and clamps negatives', () => {
		expect(durationFormat(3661)).toBe('01:01:01');
		expect(durationFormat(59.9)).toBe('00:00:59');
		expect(durationFormat(0)).toBe('00:00:00');
		expect(durationFormat(-5)).toBe('00:00:00');
		expect(durationFormat(undefined)).toBe('00:00:00');
		expect(durationFormat(360000)).toBe('100:00:00');
	});

	it('timeFormat renders 12h with meridiem and 24h without', () => {
		expect(timeFormat('2026-08-12 15:04:05', TimeFormatEnum.FORMAT_12_HOURS)).toBe('03:04:05 PM');
		expect(timeFormat('2026-08-12 15:04:05', TimeFormatEnum.FORMAT_24_HOURS)).toBe('15:04:05');
		expect(timeFormat('2026-08-12 15:04:05', TimeFormatEnum.FORMAT_24_HOURS, false)).toBe('15:04');
	});

	it('utcToTimezone renders a UTC instant in the target zone', () => {
		expect(utcToTimezone('2026-07-15T12:00:00Z', 'Asia/Kolkata')).toBe('2026-07-15 17:30:00');
		expect(utcToTimezone('2026-01-15T12:00:00Z', 'Europe/Isle_of_Man')).toBe('2026-01-15 12:00:00');
		expect(utcToTimezone('2026-07-15T12:00:00Z', 'Europe/Isle_of_Man')).toBe('2026-07-15 13:00:00');
	});

	it('dateFormat uses the organization format and locale', () => {
		expect(dateFormat('2026-08-12T00:00:00', { dateFormat: 'DD/MM/YYYY' })).toBe('12/08/2026');
		expect(dateFormat('2026-08-12T00:00:00', { dateFormat: 'MMMM D, YYYY', locale: 'en' })).toBe('August 12, 2026');
		expect(dateFormat(null)).toBe('');
		expect(dateFormat('not a date')).toBe('');
	});

	it('durationMinutesLabel is the "mm" of a slot duration', () => {
		expect(durationMinutesLabel(600)).toBe('10');
		expect(durationMinutesLabel(0)).toBe('00');
		expect(durationMinutesLabel(undefined)).toBe('00');
	});

	it('reportDateParam is MM-DD-YYYY (the reports pages contract)', () => {
		expect(reportDateParam('2026-08-03T10:00:00')).toBe('08-03-2026');
	});
});

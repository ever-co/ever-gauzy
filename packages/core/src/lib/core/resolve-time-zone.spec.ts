import { moment } from './moment-extend';
import { getDaysBetweenDates, resolveTimeZone } from './utils';

/**
 * `moment().tz(undefined)` returns undefined instead of a moment, so a report that groups its rows by
 * `.tz(timeZone).format(...)` used to answer 500 "Cannot read properties of undefined (reading
 * 'format')" whenever the request named no time zone and the organization had rows to group.
 */
describe('resolveTimeZone', () => {
	const SERVER_ZONE = moment.tz.guess();

	it.each([
		['undefined', undefined],
		['null', null as unknown as string],
		['an empty string', ''],
		['whitespace', '   ']
	])('falls back to the server zone for %s', (_label, value) => {
		expect(resolveTimeZone(value)).toBe(SERVER_ZONE);
	});

	it('keeps a named zone', () => {
		expect(resolveTimeZone('Asia/Tokyo')).toBe('Asia/Tokyo');
	});

	it('passes an unknown zone through, as before: moment-timezone logs it and stays in UTC', () => {
		expect(resolveTimeZone('Not/AZone')).toBe('Not/AZone');
	});

	it('always returns something a moment can be formatted in', () => {
		for (const value of [undefined, '', '   ', 'Asia/Tokyo']) {
			const formatted = moment.utc('2026-01-06T22:00:00.000Z').tz(resolveTimeZone(value)).format('YYYY-MM-DD');
			expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		}
	});
});

describe('getDaysBetweenDates', () => {
	it.each([
		['undefined', undefined],
		['an empty string', '']
	])('builds the day list in the server zone for %s, the zone the reports group by', (_label, value) => {
		const days = getDaysBetweenDates('2026-01-05T00:00:00.000Z', '2026-01-07T00:00:00.000Z', value);

		expect(days).toEqual(
			expect.arrayContaining([moment.utc('2026-01-06T22:00:00.000Z').tz(moment.tz.guess()).format('YYYY-MM-DD')])
		);
	});

	it('honours a named zone', () => {
		const days = getDaysBetweenDates('2026-01-05T00:00:00.000Z', '2026-01-07T00:00:00.000Z', 'Asia/Tokyo');

		expect(days[0]).toBe(moment.utc('2026-01-05T00:00:00.000Z').tz('Asia/Tokyo').format('YYYY-MM-DD'));
	});
});

import { convertLocalToTimezone } from './shared-utils';

/**
 * The appointment calendar places slots and booked appointments with this helper. Its default format used the
 * 12-hour `hh` without an AM / PM marker, so a 14:00 slot came back as "02:00:00" and was drawn at 2 AM.
 */
describe('convertLocalToTimezone', () => {
	it('keeps afternoon times on the 24-hour clock', () => {
		expect(convertLocalToTimezone('2026-10-06T14:30:00Z', null, 'UTC')).toBe('2026-10-06 14:30:00');
	});

	it('converts into the target time zone', () => {
		expect(convertLocalToTimezone('2026-10-06T14:30:00Z', null, 'Europe/Paris')).toBe('2026-10-06 16:30:00');
	});

	it('still honours an explicit format', () => {
		expect(convertLocalToTimezone('2026-10-06T14:30:00Z', null, 'UTC', 'hh:mm A')).toBe('02:30 PM');
	});
});

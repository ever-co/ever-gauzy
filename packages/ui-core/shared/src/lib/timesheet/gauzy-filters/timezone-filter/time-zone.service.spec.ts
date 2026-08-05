import moment from 'moment-timezone';
import { FALLBACK_TIME_ZONE, TimeZoneService, getDefaultTimeZone } from './time-zone.service';

/**
 * The default this service is constructed with is not a cosmetic detail: it is the value
 * every consumer OUTSIDE the Timesheets/Reports toolbar reads for the whole session.
 * `TimezoneFilterComponent` is the only caller of `setTimeZone`, so a page that does not
 * render it — manual entry in the Time Tracker, the candidate interview form, screenshot
 * timestamps — never gets a second opinion.
 *
 * The zone below is deliberately `Africa/Nairobi`: a fixed UTC+3 with no DST, so the
 * arithmetic is the same in January and July and the assertions do not depend on the
 * machine running them.
 */
describe('TimeZoneService — default time zone', () => {
	const BROWSER_ZONE = 'Africa/Nairobi'; // UTC+3 year-round

	/** Pins what the browser reports, so the test is independent of the CI machine's zone. */
	const withGuessedZone = (zone: string | undefined): jest.SpyInstance =>
		jest.spyOn(moment.tz, 'guess').mockReturnValue(zone as string);

	afterEach(() => jest.restoreAllMocks());

	it('starts on the browser time zone, not UTC', () => {
		withGuessedZone(BROWSER_ZONE);

		expect(new TimeZoneService().currentTimeZone).toBe(BROWSER_ZONE);
	});

	it('emits that default to subscribers that connect before any filter runs', (done) => {
		withGuessedZone(BROWSER_ZONE);

		new TimeZoneService().timeZone$.subscribe((timeZone) => {
			expect(timeZone).toBe(BROWSER_ZONE);
			done();
		});
	});

	describe('when the browser cannot name a zone this build knows', () => {
		// Consumers pass the value straight to `moment.tz(...)`, which answers an unknown
		// zone by silently using the browser's own offset instead of throwing. Falling back
		// to a real zone keeps `currentTimeZone` resolvable rather than quietly ambiguous.
		it.each([
			['an unknown name', 'Mars/Olympus_Mons'],
			['nothing at all', undefined]
		])('falls back to %s -> UTC', (_label, guessed) => {
			withGuessedZone(guessed as string);

			expect(getDefaultTimeZone()).toBe(FALLBACK_TIME_ZONE);
			expect(moment.tz.zone(new TimeZoneService().currentTimeZone)).toBeTruthy();
		});
	});

	describe('the offset consumers derive from it', () => {
		/**
		 * Reproduces how `TimerRangePickerComponent` turns a picked wall-clock time into the
		 * instant that is POSTed: resolve the zone's offset for the day being edited, then
		 * parse the wall-clock string against it.
		 */
		const composeInstant = (service: TimeZoneService, day: string, time: string): Date => {
			const offset = moment.tz(day, service.currentTimeZone).format('Z');
			return new Date(`${day} ${time}${offset}`);
		};

		it('files a manually entered time at the clock the user typed it on', () => {
			withGuessedZone(BROWSER_ZONE);

			// 11:30 for a user at UTC+3 is 08:30Z — under the old `Etc/UTC` default this was
			// filed as 11:30Z, three hours after the moment they meant.
			expect(composeInstant(new TimeZoneService(), '2026-08-06', '11:30').toISOString()).toBe(
				'2026-08-06T08:30:00.000Z'
			);
		});

		it('still honours an explicit selection over the default', () => {
			withGuessedZone(BROWSER_ZONE);
			const service = new TimeZoneService();

			// What the timezone filter does when the user picks "UTC".
			service.setTimeZone(FALLBACK_TIME_ZONE);

			expect(composeInstant(service, '2026-08-06', '11:30').toISOString()).toBe('2026-08-06T11:30:00.000Z');
		});
	});

	it('keeps the current zone when asked to select an invalid one', () => {
		withGuessedZone(BROWSER_ZONE);
		const service = new TimeZoneService();
		jest.spyOn(console, 'error').mockImplementation(() => {});

		service.setTimeZone('Not/AZone');

		expect(service.currentTimeZone).toBe(BROWSER_ZONE);
	});
});

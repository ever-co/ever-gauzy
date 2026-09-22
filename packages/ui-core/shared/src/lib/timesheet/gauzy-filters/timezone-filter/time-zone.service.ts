import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import moment from 'moment-timezone';
import { TimeFormatEnum } from '@gauzy/contracts';

/**
 * Zone used only when the browser cannot name one this build knows about.
 *
 * `moment.tz.guess()` falls back to an offset-based match when `Intl` is
 * unavailable, so it can in principle answer with a name the bundled zone data
 * does not carry. Every consumer feeds this value straight into `moment.tz(...)`
 * (see `toUtcOffset`), and moment answers an unknown zone by silently using the
 * BROWSER's offset rather than throwing — an unvalidated guess would therefore
 * degrade into "sometimes the configured zone, sometimes local" with no signal.
 * Pinning the fallback keeps the invariant every consumer relies on: whatever
 * this service holds is a zone moment can resolve.
 */
export const FALLBACK_TIME_ZONE = 'Etc/UTC';

/**
 * The time zone this service starts on, before any filter has selected one.
 *
 * `TimezoneFilterComponent` is the only thing that ever calls {@link
 * TimeZoneService.setTimeZone}, and it lives in the Timesheets/Reports toolbar.
 * Every other consumer — manual entry in the Time Tracker, the candidate
 * interview form, screenshot timestamps, the gallery, the dashboard widgets —
 * only reads. For a session that has not yet opened a page carrying that
 * toolbar, the construction default below is the ONLY value they ever see.
 *
 * That default used to be `Etc/UTC`, which made those screens quote a clock
 * nobody is on: a user at UTC+3 entering 11:30 had the instant composed as
 * 11:30Z — three hours off the time they typed — and, once the display was
 * brought into line with the write path, saw it read back as 08:30. Guessing
 * the browser zone is the honest answer to "the user has told us nothing yet":
 * it is the clock on the wall behind them, and it puts the read and the write
 * on the same one.
 *
 * This only sets the STARTING point. On any page that hosts the filter, the
 * filter overwrites it during init with the organization zone (for users who
 * may switch employees) or the user's own zone, so the default is transient
 * there and the timesheet grid's query range is unaffected.
 *
 * @returns An IANA zone name that `moment.tz` resolves.
 */
export function getDefaultTimeZone(): string {
	const guessed = moment.tz.guess();
	return guessed && moment.tz.zone(guessed) ? guessed : FALLBACK_TIME_ZONE;
}

@Injectable({
	providedIn: 'root'
})
export class TimeZoneService {
	private timeZoneSubject$: BehaviorSubject<string>;
	private timeFormatSubject$: BehaviorSubject<TimeFormatEnum>;

	constructor() {
		// Start on the browser's zone; the timezone filter replaces it where one is rendered.
		this.timeZoneSubject$ = new BehaviorSubject<string>(getDefaultTimeZone());
		this.timeFormatSubject$ = new BehaviorSubject<TimeFormatEnum>(TimeFormatEnum.FORMAT_12_HOURS);
	}

	// Get the current timezone as an observable
	get timeZone$() {
		return this.timeZoneSubject$.asObservable();
	}

	// Get the current timezone as an observable
	get timeFormat$() {
		return this.timeFormatSubject$.asObservable();
	}

	// Get the current timezone value
	get currentTimeZone() {
		return this.timeZoneSubject$.getValue();
	}

	// Get the current timeformat value
	get currentTimeFormat() {
		return this.timeFormatSubject$.getValue();
	}

	/**
	 * Sets a new timezone.
	 *
	 * @param {string} timeZone - The timezone to be set.
	 */
	setTimeZone(timeZone: string): void {
		if (moment.tz.zone(timeZone)) {
			this.timeZoneSubject$.next(timeZone);
		} else {
			console.error('Invalid timezone:', timeZone);
		}
	}

	/**
	 * Sets the time format.
	 *
	 * @param {TimeFormatEnum} timeFormat - The time format to be set.
	 */
	setTimeFormat(timeFormat: TimeFormatEnum): void {
		this.timeFormatSubject$.next(timeFormat);
	}
}

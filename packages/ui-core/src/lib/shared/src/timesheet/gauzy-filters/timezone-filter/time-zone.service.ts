import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import moment from 'moment-timezone';
import { TimeFormatEnum } from '@gauzy/contracts';

@Injectable({
	providedIn: 'root'
})
export class TimeZoneService {
	private timeZoneSubject$: BehaviorSubject<string>;
	private timeFormatSubject$: BehaviorSubject<TimeFormatEnum>;

	constructor() {
		// Initialize with default timezone, for example, 'Etc/UTC'
		this.timeZoneSubject$ = new BehaviorSubject<string>('Etc/UTC');
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

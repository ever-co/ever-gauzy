import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import moment from 'moment-timezone';

@Injectable({
	providedIn: 'root'
})
export class TimeZoneService {
	private timeZoneSubject$: BehaviorSubject<string>;

	constructor() {
		// Initialize with default timezone, for example, 'Etc/UTC'
		this.timeZoneSubject$ = new BehaviorSubject<string>('Etc/UTC');
	}

	// Get the current timezone as an observable
	get timeZone$() {
		return this.timeZoneSubject$.asObservable();
	}

	// Get the current timezone value
	get currentTimeZone() {
		return this.timeZoneSubject$.getValue();
	}

	/**
	 * Set a new timezone
	 * @param timeZone The timezone to be set
	 */
	setTimeZone(timeZone: string): void {
		if (moment.tz.zone(timeZone)) {
			this.timeZoneSubject$.next(timeZone);
		} else {
			console.error('Invalid timezone:', timeZone);
		}
	}
}

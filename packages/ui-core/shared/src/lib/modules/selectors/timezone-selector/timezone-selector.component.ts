import { Component, EventEmitter, forwardRef, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { UntilDestroy } from '@ngneat/until-destroy';
import * as timezone from 'moment-timezone';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-timezone-selector',
	templateUrl: './timezone-selector.component.html',
	styleUrls: ['./timezone-selector.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TimeZoneSelectorComponent),
			multi: true
		}
	]
})
export class TimeZoneSelectorComponent implements OnInit, OnDestroy {
	listOfZones = timezone.tz.names().filter((zone) => zone.includes('/'));
	onChange: any = () => {};
	onTouched: any = () => {};

	/*
	 * Getter & Setter for dynamic timezone option
	 */
	private _timeZone: string;
	@Input() set timeZone(val: string) {
		this._timeZone = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get timeZone(): string {
		return this._timeZone;
	}

	@Output() onChanged = new EventEmitter<string>();

	constructor() {}

	/**
	 *
	 */
	ngOnInit(): void {}

	/**
	 *
	 * @param zone
	 * @returns
	 */
	getTimeZoneWithOffset(zone: string) {
		let cutZone = zone;
		if (zone.includes('/')) {
			cutZone = zone.split('/')[1];
		}

		const offset = timezone.tz(zone).format('zZ');
		return '(' + offset + ') ' + cutZone;
	}

	/**
	 *
	 * @param value
	 */
	writeValue(value: string) {
		if (value) {
			this._timeZone = value;
		}
	}

	/**
	 *
	 * @param fn
	 */
	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	/**
	 *
	 * @param fn
	 */
	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	/**
	 *
	 * @param timeZone
	 */
	selectTimeZone(timeZone: string): void {
		this.timeZone = timeZone;
		this.onChanged.emit(timeZone);
	}

	/**
	 *
	 */
	ngOnDestroy(): void {}
}

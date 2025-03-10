import { Component, Input, forwardRef, Output, EventEmitter } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { TimeFormatEnum } from '@gauzy/contracts';
import * as moment from 'moment';

@Component({
	selector: 'ga-manual-timer-picker',
	templateUrl: './manual-timer-picker.component.html',
	styleUrls: ['./manual-timer-picker.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => ManualTimerPickerComponent),
			multi: true
		}
	]
})
export class ManualTimerPickerComponent {
	private _value = '';
	timeFormat = TimeFormatEnum.FORMAT_24_HOURS;
	errorMessage: string | null = null;
	onChange: (value: string) => void = () => {};
	onTouched: () => void = () => {};

	@Input() disabled = false;
	@Output() change: EventEmitter<string> = new EventEmitter<string>();

	get value(): string {
		return this._value;
	}

	set value(val: string) {
		if (!val) {
			this.onChange(null);
			this.errorMessage = null;
			return;
		}
		if (this.isValidTimeFormat(val)) {
			this._value = moment(val, 'HH:mm:ss').format('HH:mm:ss');
			this.onChange(val);
			this.onTouched();
			this.change.emit(val);
			this.errorMessage = null;
		} else {
			this.onChange(null);
			this.errorMessage = 'VALIDATION.INVALID_TIME_FORMAT';
		}
	}

	/**
	 * Check if a string matches the HH:mm:ss format.
	 */
	private isValidTimeFormat(time: string): boolean {
		const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
		return timeRegex.test(time);
	}

	writeValue(value: string): void {
		if (value) {
			this._value = moment(value, 'HH:mm:ss').format('HH:mm:ss');
		} else {
			this._value = '';
		}
	}

	registerOnChange(fn: (value: string) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this.disabled = isDisabled;
	}
}

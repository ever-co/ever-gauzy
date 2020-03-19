import { Component, OnInit, Input, forwardRef } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import * as moment from 'moment';

@Component({
	selector: 'ga-timer-picker',
	templateUrl: './timer-picker.component.html',
	styleUrls: ['./timer-picker.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TimerPickerComponent),
			multi: true
		}
	]
})
export class TimerPickerComponent implements OnInit {
	timeSlots: { value: string; label: string }[] = [];
	onChange: any = () => {};
	onTouched: any = () => {};
	val: any;

	@Input() disabled = false;
	@Input() min: string = '00:00';
	@Input() max: string = '23:59';

	constructor() {}

	set selectedTime(val: string) {
		this.val = val;
		this.onChange(val);
		this.onTouched(val);
	}

	get selectedTime() {
		return this.val;
	}

	ngOnInit() {
		this.updateSlots();
	}

	updateSlots() {
		const interval = 10;
		let slotTime = moment(this.min, 'HH:mm');
		let endTime = moment(this.max, 'HH:mm');

		let times = [];
		while (slotTime < endTime) {
			times.push({
				value: slotTime.format('HH:mm'),
				label: slotTime.format('hh:mm A')
			});

			slotTime = slotTime.add(interval, 'minutes');
		}

		this.timeSlots = times;
	}

	writeValue(value: any) {
		this.selectedTime = value;
	}
	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this.disabled = isDisabled;
	}
}

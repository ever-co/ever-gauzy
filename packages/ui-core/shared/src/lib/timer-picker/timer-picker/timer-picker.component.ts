import {
	Component,
	OnInit,
	Input,
	forwardRef,
	Output,
	EventEmitter
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import * as moment from 'moment';
import { IOrganization } from '@gauzy/contracts';

@Component({
	selector: 'ga-timer-picker',
	templateUrl: './timer-picker.component.html',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TimerPickerComponent),
			multi: true
		}
	]
})
export class TimerPickerComponent implements OnInit {
	private _max: string = '23:00';
	private _min: string = '00:00';
	timeSlots: { value: string; label: string }[] = [];
	organization: IOrganization;
	onChange: any = () => {};
	onTouched: any = () => {};
	val: any;
	@Input() disabled = false;
	@Input()
	public get min(): string {
		return this._min;
	}
	public set min(value: string) {
		this._min = value;
		this.updateSlots();
	}
	@Input()
	public get max(): string {
		return this._max;
	}
	public set max(value: string) {
		this._max = value;
		this.updateSlots();
	}

	@Output() change: EventEmitter<string> = new EventEmitter();

	constructor() {}

	set selectedTime(val: string) {
		this.val = val;
		this.onChange(val);
		this.onTouched(val);
		this.change.emit(val);
	}

	get selectedTime() {
		return this.val;
	}

	ngOnInit() {
		this.updateSlots();
	}

	updateSlots() {
		const interval = 5;
		let slotTime = moment(this.min, 'HH:mm');
		const endTime = moment(this.max, 'HH:mm');

		const times = [];
		while (slotTime <= endTime) {
			times.push({
				value: slotTime.format('HH:mm'),
				label: slotTime.format('hh:mm A')
			});

			slotTime = slotTime.add(interval, 'minutes');
		}
		this.timeSlots = times;
	}

	writeValue(value: any) {
		this.val = value;
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

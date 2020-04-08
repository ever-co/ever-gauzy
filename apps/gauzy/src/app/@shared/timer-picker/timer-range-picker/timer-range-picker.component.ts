import {
	Component,
	OnInit,
	forwardRef,
	Input,
	ViewChild,
	AfterViewInit
} from '@angular/core';
import { NG_VALUE_ACCESSOR, NgModel } from '@angular/forms';
import { IDateRange } from '@gauzy/models';
import * as moment from 'moment';
import { merge } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
	selector: 'ngx-timer-range-picker',
	templateUrl: './timer-range-picker.component.html',
	styleUrls: ['./timer-range-picker.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TimerRangePickerComponent),
			multi: true
		}
	]
})
export class TimerRangePickerComponent implements OnInit, AfterViewInit {
	onChange: any = () => {};
	onTouched: any = () => {};
	endTime: string;
	startTime: string;
	date: Date;
	maxSlotStartTime: string;
	minSlotStartTime: string;
	maxSlotEndTime: string;
	minSlotEndTime: string;

	@ViewChild('dateModel', { static: false }) dateModel: NgModel;
	@ViewChild('startTimeModel', { static: false }) startTimeModel: NgModel;
	@ViewChild('endTimeModel', { static: false }) endTimeModel: NgModel;

	private _maxDate: Date = null;

	@Input('maxDate')
	public get maxDate(): Date {
		return this._maxDate;
	}
	public set maxDate(value: Date) {
		this._maxDate = value;
		this.updateTimePickerLimit(value);
	}
	private _selectedRange: IDateRange;
	public get selectedRange(): IDateRange {
		return this._selectedRange;
	}
	public set selectedRange(value: IDateRange) {
		this._selectedRange = value;
		this.onChange(value);
	}

	constructor() {}

	ngOnInit() {}

	ngAfterViewInit() {
		merge(
			this.dateModel.valueChanges,
			this.startTimeModel.valueChanges,
			this.endTimeModel.valueChanges
		)
			.pipe(debounceTime(10))
			.subscribe((data) => {
				const start = new Date(
					moment(this.date).format('YYYY-MM-DD') +
						' ' +
						this.startTime
				);
				const end = new Date(
					moment(this.date).format('YYYY-MM-DD') + ' ' + this.endTime
				);
				this.selectedRange = {
					start: isNaN(start.getTime()) ? null : start,
					end: isNaN(start.getTime()) ? null : end
				};
			});
	}

	updateTimePickerLimit(date: Date) {
		let mTime = moment(date);

		if (mTime.isSame(new Date(), 'day')) {
			mTime = mTime.set({
				hour: moment().get('hour'),
				minute: moment().get('minute') - (moment().minutes() % 10),
				second: 0,
				millisecond: 0
			});
			if (!this.date) {
				this.date = mTime.toDate();
			}
			if (!this.startTime) {
				this.startTime = mTime
					.clone()
					.subtract(30, 'minutes')
					.format('HH:mm');
			}
			if (!this.endTime) {
				this.endTime = mTime.format('HH:mm');
			}
		}

		if (mTime.isSame(new Date(), 'day')) {
			this.minSlotStartTime = '00:00';
			this.maxSlotStartTime = mTime
				.clone()
				.subtract(10, 'minutes')
				.format('HH:mm');
			this.maxSlotEndTime = mTime.format('HH:mm');
		} else {
			this.minSlotStartTime = '00:00';
			this.maxSlotStartTime = '23:59';
			this.maxSlotEndTime = '23:59';
		}
		this.updateEndTimeSlot(this.startTime);
	}

	updateEndTimeSlot(time: string) {
		this.minSlotEndTime = moment(time, 'HH:mm')
			.add(10, 'minutes')
			.format('HH:mm');
		// if (!moment(time, 'HH:mm').isBefore(moment(this.endTime, 'HH:mm'))) {
		// 	if (this.startTime) {
		// 		this.endTime = moment(this.startTime, 'HH:mm')
		// 			.add(30, 'minutes')
		// 			.format('HH:mm');
		// 	} else {
		// 		this.endTime = null;
		// 	}
		// }
	}

	writeValue(value: IDateRange) {
		if (value) {
			let start = moment(value.start);
			this.date = start.toDate();

			let hour = start.get('hour');
			let minute = start.get('minute') - (start.minutes() % 10);
			this.startTime = `${hour}:${minute}`;

			let end = moment(value.end);
			hour = end.get('hour');
			minute = end.get('minute') - (end.minutes() % 10);
			this.endTime = `${hour}:${minute}`;
		}
		this._selectedRange = value;
		//this.updateTimePickerLimit(value.start)-
	}
	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}
}

import {
	Component,
	OnInit,
	forwardRef,
	Input,
	ViewChild,
	ChangeDetectorRef,
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
	private _maxDate: Date = null;
	private _minDate: Date = null;
	private _disabledDates: number[] = [];

	@Input() slotStartTime: Date;
	@Input() slotEndTime: Date;
	@Input() allowedDuration: number;
	@Input() disableEndPicker = false;
	@Input() disableDatePicker = false;
	@Input() fromEmployeeAppointment = false;

	@Input('maxDate')
	public get maxDate(): Date {
		return this._maxDate;
	}
	public set maxDate(value: Date) {
		this._maxDate = value;
		!this.fromEmployeeAppointment && this.updateTimePickerLimit(value);
	}

	@Input('minDate')
	public get minDate(): Date {
		return this._minDate;
	}
	public set minDate(value: Date) {
		this._minDate = value;
		!this.fromEmployeeAppointment && this.updateTimePickerLimit(value);
	}

	@Input('disabledDates')
	public get disabledDates() {
		return this._disabledDates;
	}
	public set disabledDates(value: number[]) {
		this._disabledDates = value;
	}

	private _selectedRange: IDateRange;
	public get selectedRange(): IDateRange {
		return this._selectedRange;
	}
	public set selectedRange(value: IDateRange) {
		this._selectedRange = value;
		this.onChange(value);
	}

	@ViewChild('dateModel') dateModel: NgModel;
	@ViewChild('startTimeModel') startTimeModel: NgModel;
	@ViewChild('endTimeModel') endTimeModel: NgModel;
	endTime: string;
	startTime: string;
	date: Date;
	maxSlotStartTime: string;
	minSlotStartTime: string;
	maxSlotEndTime: string;
	minSlotEndTime: string;

	constructor(private cd: ChangeDetectorRef) {}

	onChange: any = () => {};
	onTouched: any = () => {};
	filter = (date) => !this._disabledDates.includes(date.getTime());

	ngOnInit() {
		if (this.fromEmployeeAppointment) {
			let maxTime = moment(this._maxDate);
			let minTime = moment(this._minDate);

			this.minSlotStartTime = minTime.format('HH:mm');
			this.maxSlotStartTime = moment(maxTime, 'HH:mm')
				.subtract(5, 'minutes')
				.format('HH:mm');
			this.maxSlotEndTime = maxTime.format('HH:mm');
			this.minSlotEndTime = moment(minTime, 'HH:mm')
				.add(5, 'minutes')
				.format('HH:mm');
		}
	}

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

				if (
					this.slotStartTime &&
					this.slotEndTime &&
					this.allowedDuration
				) {
					this.minSlotStartTime = moment(this.slotStartTime)
						.clone()
						.format('HH:mm');
					this.maxSlotStartTime = moment(this.slotEndTime)
						.clone()
						.subtract(this.allowedDuration, 'minutes')
						.format('HH:mm');
					this.endTime = moment(this.startTime, 'HH:mm')
						.add(this.allowedDuration, 'minutes')
						.format('HH:mm');
				}

				this.selectedRange = {
					start: isNaN(start.getTime()) ? null : start,
					end: isNaN(start.getTime()) ? null : end
				};
				this.cd.detectChanges();
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

		console.log('this.startTime', this.startTime);

		this.updateEndTimeSlot(this.startTime);
	}

	chnageStartTime(time: string) {
		if (this.slotStartTime && this.allowedDuration) {
			this.endTime = moment(time, 'HH:mm')
				.add(this.allowedDuration, 'minutes')
				.format('HH:mm');
		} else if (time) {
			this.updateEndTimeSlot(time);
			if (
				!moment(time, 'HH:mm').isBefore(moment(this.endTime, 'HH:mm'))
			) {
				this.endTime = moment(time, 'HH:mm')
					.add(this.fromEmployeeAppointment ? 5 : 30, 'minutes')
					.format('HH:mm');
			}
		} else {
			this.endTime = null;
		}
	}

	updateEndTimeSlot(time: string) {
		this.minSlotEndTime = moment(time, 'HH:mm')
			.add(this.allowedDuration || 10, 'minutes')
			.format('HH:mm');
	}

	writeValue(value: IDateRange) {
		if (value) {
			if (!value.start) {
				value.start = moment().subtract(30, 'minutes').toDate();
			}
			if (!value.end) {
				value.end = new Date();
			}

			const start = moment(value.start);
			this.date = start.toDate();

			let hour = start.get('hour');
			let minute = this.fromEmployeeAppointment
				? start.get('minute')
				: start.get('minute') - (start.minutes() % 10);
			this.startTime = `${hour}:${minute}`;

			const end = moment(value.end);
			hour = end.get('hour');
			minute = this.fromEmployeeAppointment
				? end.get('minute')
				: end.get('minute') - (end.minutes() % 10);
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

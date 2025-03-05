import * as moment from 'moment';
import * as timezone from 'moment-timezone';
import {
	Component,
	forwardRef,
	Input,
	ViewChild,
	ChangeDetectorRef,
	AfterViewInit,
	Output,
	EventEmitter
} from '@angular/core';
import { NG_VALUE_ACCESSOR, NgModel } from '@angular/forms';
import { IDateRange } from '@gauzy/contracts';
import { merge, Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

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
export class TimerRangePickerComponent implements AfterViewInit {
	private _maxDate: Date = null;
	private _minDate: Date = null;
	private _disabledDates: number[] = [];
	private _destroy$: Subject<void> = new Subject<void>();
	private _selectedRange: IDateRange;

	@Input() allowedDuration: number;
	@Input() disableEndPicker = false;
	@Input() disableDatePicker = false;
	@Input() fromEmployeeAppointment = false;
	@Input() timezoneOffset: string;
	@Input() customClass?: string = '';

	@Input('maxDate')
	public get maxDate(): Date {
		return this._maxDate;
	}
	public set maxDate(value: Date) {
		this._maxDate = value;
	}

	@Input('minDate')
	public get minDate(): Date {
		return this._minDate;
	}
	public set minDate(value: Date) {
		this._minDate = value;
	}

	@Input('disabledDates')
	public get disabledDates() {
		return this._disabledDates;
	}
	public set disabledDates(value: number[]) {
		this._disabledDates = value;
	}

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

	@Output() selectedRangeChange = new EventEmitter<IDateRange>();
	@Output() validationStatus = new EventEmitter<boolean>();

	endTime: string;
	startTime: string;
	date: Date;
	errorMessage: string | null = null;

	constructor(private cd: ChangeDetectorRef) {}

	onChange: any = () => {};
	onTouched: any = () => {};
	filter = (date) => !this._disabledDates.includes(date.getTime());

	ngAfterViewInit() {
		this.timezoneOffset = this.timezoneOffset || timezone.tz(timezone.tz.guess()).format('Z');
		merge(this.dateModel.valueChanges, this.startTimeModel.valueChanges, this.endTimeModel.valueChanges)
			.pipe(debounceTime(10), takeUntil(this._destroy$))
			.subscribe(() => {
				this.updateSelectedRange();
				this.validateDate();
				this.validateInputs();
			});
	}

	updateSelectedRange() {
		if (!this.date) return;

		const selectedDate = moment(this.date).format('YYYY-MM-DD');

		if (!this.startTime || !this.endTime) {
			this.resetSelectedRange();
			return;
		}

		const startDate = this.parseDateTime(selectedDate, this.startTime);
		let endDate = this.parseDateTime(selectedDate, this.endTime);

		if (!moment(endDate).isSame(startDate, 'day')) {
			endDate = moment(startDate).endOf('day').toDate();
		}

		this.selectedRange = {
			start: this.isValidDate(startDate) ? startDate : null,
			end: this.isValidDate(endDate) ? endDate : null
		};

		this.selectedRangeChange.emit(this.selectedRange);
	}

	/**
	 * Helper function to parse date and time
	 */
	private parseDateTime(date: string, time: string): Date {
		return moment(`${date} ${time}${this.timezoneOffset}`, 'YYYY-MM-DD HH:mm:ssZ').toDate();
	}

	/**
	 * Helper function to reset selected range to null
	 */
	private resetSelectedRange() {
		this.selectedRange = { start: null, end: null };
	}

	/**
	 * Helper function to check if a date is valid
	 */
	private isValidDate(date: Date): boolean {
		return date instanceof Date && !isNaN(date.getTime());
	}

	/**
	 * Ensures the input values are valid and within a single day
	 */
	validateInputs() {
		const selectedDate = moment(this.date).format('YYYY-MM-DD');
		const startDateTime = moment(`${selectedDate} ${this.startTime}`, 'YYYY-MM-DD HH:mm:ss');
		const endDateTime = moment(`${selectedDate} ${this.endTime}`, 'YYYY-MM-DD HH:mm:ss');
		this.errorMessage = null;
		this.validationStatus.emit(true);

		if (this.startTime && this.endTime) {
			if (endDateTime.isBefore(startDateTime)) {
				this.errorMessage = 'VALIDATION.END_TIME_BEFORE_START_TIME';
				this.validationStatus.emit(false);
			} else if (endDateTime.isSameOrBefore(startDateTime)) {
				this.errorMessage = 'VALIDATION.END_TIME_LATER_THAN_START_TIME';
				this.validationStatus.emit(false);
			} else {
				this.errorMessage = null;
				this.validationStatus.emit(true);
			}
		}

		if (this.startTime === '23:59:59' && this.endTime === '23:59:59') {
			this.errorMessage = 'VALIDATION.START_TIME_EARLIER_THAN_END_TIME';
			this.validationStatus.emit(false);
		}

		this.cd.detectChanges();
	}

	/**
	 * Ensures the calendar input is valid
	 */
	validateDate() {
		if (!moment(this.date, 'YYYY-MM-DD', true).isValid()) {
			this.date = new Date();
		}
		this.cd.detectChanges();
	}

	/**
	 * Sets the initial date and time values based on incoming dateRange
	 */
	writeValue(value: IDateRange) {
		if (value) {
			this.date = value.start ? moment(value.start).toDate() : new Date();
			this.startTime = value.start ? moment(value.start).format('HH:mm:ss') : null;
			this.endTime = value.end ? moment(value.end).format('HH:mm:ss') : null;
		}
	}

	registerOnChange(fn: (value: IDateRange) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	ngOnDestroy() {
		this._destroy$.next();
		this._destroy$.complete();
	}
}

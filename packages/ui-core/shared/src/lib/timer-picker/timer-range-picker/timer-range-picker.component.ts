import moment from 'moment';
import timezone from 'moment-timezone';
import { Component, OnInit, forwardRef, Input, ViewChild, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { NG_VALUE_ACCESSOR, NgModel } from '@angular/forms';
import { IDateRange } from '@gauzy/contracts';
import { merge } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
// The service's own file, not the folder barrel: that barrel also exports the filter COMPONENT,
// which pulls in `@gauzy/ui-core` and, with it, half the app — enough to make this component
// untestable in isolation.
import { TimeZoneService } from '../../timesheet/gauzy-filters/timezone-filter/time-zone.service';

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
	],
	standalone: false
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
	@Input() timezoneOffset: string;

	@Input('maxDate')
	public get maxDate(): Date {
		return this._maxDate;
	}
	public set maxDate(value: Date) {
		this._maxDate = value;
		if (!this.fromEmployeeAppointment) {
			this.updateTimePickerLimit(value);
		}
	}

	@Input('minDate')
	public get minDate(): Date {
		return this._minDate;
	}
	public set minDate(value: Date) {
		this._minDate = value;
		if (!this.fromEmployeeAppointment) {
			this.updateTimePickerLimit(value);
		}
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

	/**
	 * True when the host bound `[timezoneOffset]` explicitly (manage-appointment does,
	 * from the appointment's own timezone). Recorded before the default is applied so
	 * a supplied offset is never mistaken for a derived one.
	 */
	private hasExplicitTimezoneOffset = false;

	constructor(
		private cd: ChangeDetectorRef,
		private readonly timeZoneService: TimeZoneService
	) {}

	/**
	 * The UTC offset used to turn the picked wall-clock time into an instant.
	 *
	 * This used to be the BROWSER's offset (`timezone.tz.guess()`), while every read of
	 * time logs filters by the configured Gauzy timezone (`TimeZoneService`, consumed in
	 * `BaseSelectorFilterComponent`). When the two differ, a log created near a day
	 * boundary is written at an instant that falls outside the day the grid asks for, and
	 * it silently disappears: the POST returns 201, and the GET that follows comes back
	 * empty. Deriving from the same service the read path uses keeps write and read on
	 * one clock.
	 *
	 * Resolved per call rather than once, and against the date being edited rather than
	 * "now", because a zone's offset changes across a DST boundary — asking for today's
	 * offset while entering time for the other side of that boundary files the log an
	 * hour out.
	 *
	 * @param date - The date the entry is being made for.
	 * @returns A `±HH:mm` offset string.
	 */
	private resolveTimezoneOffset(date: Date | string): string {
		if (this.hasExplicitTimezoneOffset && this.timezoneOffset) {
			return this.timezoneOffset;
		}
		const on = moment(date ?? new Date()).format('YYYY-MM-DD');
		return timezone.tz(on, this.timeZoneService.currentTimeZone).format('Z');
	}

	/**
	 * Re-express an instant in the zone this picker DISPLAYS, so the wall-clock time shown is the one
	 * {@link resolveTimezoneOffset} will read back.
	 *
	 * The inverse of the write path, and it has to be: `writeValue` used to read an existing range
	 * with a plain `moment()`, i.e. in the BROWSER's zone, while the write composes the instant from
	 * the configured Gauzy zone. Opening a saved log for edit then showed times shifted by the
	 * difference — and where that shift moved the start past the end (a log recorded near midnight in
	 * a zone ahead of the browser's), the period computed as zero and the dialog refused to save an
	 * edit that changed nothing but the description.
	 *
	 * Reads `timezoneOffset` directly rather than via `hasExplicitTimezoneOffset`: Angular calls
	 * `writeValue` while binding the control, which is BEFORE `ngAfterViewInit` records that flag.
	 *
	 * @param value - The instant to convert.
	 * @returns The same instant, expressed in the displayed zone.
	 */
	private toDisplayZone(value: Date | string): moment.Moment {
		if (this.timezoneOffset) {
			return moment(value).utcOffset(this.timezoneOffset);
		}
		return timezone.tz(value, this.timeZoneService.currentTimeZone);
	}

	/**
	 * A displayed instant as the `HH:mm` the time picker offers.
	 *
	 * Snapped DOWN to the picker's 10-minute slots (except for appointments, which use 5-minute
	 * precision and keep the exact minute), and zero-padded — the picker's options are `HH:mm`, so a
	 * `9:0` without the leading zeros matches none of them and the field renders blank.
	 */
	private toSlotTime(value: moment.Moment): string {
		const minute = this.fromEmployeeAppointment ? value.minute() : value.minute() - (value.minute() % 10);
		return `${String(value.hour()).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
	}

	onChange: any = () => {};
	onTouched: any = () => {};
	filter = (date) => !this._disabledDates.includes(date.getTime());

	ngOnInit() {
		if (this.fromEmployeeAppointment) {
			const maxTime = moment(this._maxDate);
			const minTime = moment(this._minDate);

			this.minSlotStartTime = minTime.format('HH:mm');
			this.maxSlotStartTime = moment(maxTime, 'HH:mm').subtract(5, 'minutes').format('HH:mm');
			this.maxSlotEndTime = maxTime.format('HH:mm');
			this.minSlotEndTime = moment(minTime, 'HH:mm').add(5, 'minutes').format('HH:mm');
		}
	}

	ngAfterViewInit() {
		this.hasExplicitTimezoneOffset = !!this.timezoneOffset;
		merge(this.dateModel.valueChanges, this.startTimeModel.valueChanges, this.endTimeModel.valueChanges)
			.pipe(debounceTime(10))
			.subscribe((data) => {
				const day = moment(this.date).format('YYYY-MM-DD');
				const offset = this.resolveTimezoneOffset(this.date);
				const start = new Date(day + ' ' + this.startTime + offset);
				const end = new Date(day + ' ' + this.endTime + offset);

				if (this.slotStartTime && this.slotEndTime && this.allowedDuration) {
					this.minSlotStartTime = moment(this.slotStartTime).clone().format('HH:mm');
					this.maxSlotStartTime = moment(this.slotEndTime)
						.clone()
						.subtract(this.allowedDuration, 'minutes')
						.format('HH:mm');
					this.endTime = moment(this.startTime, 'HH:mm').add(this.allowedDuration, 'minutes').format('HH:mm');
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
				this.startTime = mTime.clone().subtract(30, 'minutes').format('HH:mm');
			}
			if (!this.endTime) {
				this.endTime = mTime.format('HH:mm');
			}
		}

		if (mTime.isSame(new Date(), 'day')) {
			this.minSlotStartTime = '00:00';
			this.maxSlotStartTime = mTime.clone().subtract(10, 'minutes').format('HH:mm');
			this.maxSlotEndTime = mTime.format('HH:mm');
		} else {
			this.minSlotStartTime = '00:00';
			this.maxSlotStartTime = '23:59';
			this.maxSlotEndTime = '23:59';
		}

		this.updateEndTimeSlot(this.startTime);
	}

	changeStartTime(time: string) {
		if (this.slotStartTime && this.allowedDuration) {
			this.endTime = moment(time, 'HH:mm').add(this.allowedDuration, 'minutes').format('HH:mm');
		} else if (time) {
			this.updateEndTimeSlot(time);
			if (!moment(time, 'HH:mm').isBefore(moment(this.endTime, 'HH:mm'))) {
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
				value.end = moment().toDate();
			}

			const start = this.toDisplayZone(value.start);
			const end = this.toDisplayZone(value.end);

			this.startTime = this.toSlotTime(start);
			this.endTime = this.toSlotTime(end);

			// The DAY comes from the start, not the end. The write path composes BOTH times onto this
			// one date (`day + startTime`, `day + endTime`), so for a log whose start and end fall on
			// different days in the displayed zone, taking the end's day would place the start after
			// the end, and the range could no longer be saved. For an ordinary same-day log the two agree.
			//
			// Rebuilt as browser-local midnight of that calendar day rather than passed through as an
			// instant: the date input and `resolveTimezoneOffset` both read this with a plain
			// `moment()`, so what has to survive is the CALENDAR DAY, not the instant.
			this.date = moment(start.format('YYYY-MM-DD'), 'YYYY-MM-DD').toDate();
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

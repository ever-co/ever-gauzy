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

	constructor(
		private cd: ChangeDetectorRef,
		private readonly timeZoneService: TimeZoneService
	) {}

	/**
	 * Re-express an instant in the zone this picker DISPLAYS.
	 *
	 * The exact inverse of {@link composeInstant}, and it has to be. `writeValue` used to read an
	 * existing range with a plain `moment()`, i.e. in the BROWSER's zone, while the write composes the
	 * instant from the configured Gauzy zone. Opening a saved log for edit then showed times shifted
	 * by the difference — and where that shift moved the start past the end (a log recorded near
	 * midnight in a zone ahead of the browser's), the period computed as zero and the dialog refused
	 * to save an edit that changed nothing but the description.
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
	 * Turn a picked calendar day + wall-clock time into an instant, in the zone this picker displays.
	 *
	 * The zone used to be the BROWSER's (`timezone.tz.guess()`), while every read of time logs filters
	 * by the configured Gauzy timezone (`TimeZoneService`, consumed in `BaseSelectorFilterComponent`).
	 * When the two differ, a log created near a day boundary is written at an instant outside the day
	 * the grid asks for and silently disappears: the POST returns 201, the GET that follows comes back
	 * empty.
	 *
	 * Resolved AT THE WALL-CLOCK TIME, not once per day. The previous version derived a single `±HH:mm`
	 * offset from the day's midnight and appended it to every time on that day; on a DST transition day
	 * the offset at midnight is not the offset at 03:30, so an entry on the far side of the transition
	 * was filed an hour out. Now that the read path shows the offset in effect at the stored instant,
	 * that mismatch would also move a log by an hour just for being opened and re-saved unchanged.
	 * Handing the whole wall-clock string to moment-timezone lets it pick the right offset itself.
	 *
	 * Reads `timezoneOffset` directly rather than through a flag recorded in `ngAfterViewInit`: the
	 * read side runs during `writeValue`, which Angular calls while binding the control — earlier than
	 * any such flag could be set. Both sides must answer the same question the same way.
	 *
	 * @param day - Calendar day as `YYYY-MM-DD`.
	 * @param time - Wall-clock time as `HH:mm`.
	 * @returns The instant, or `null` when either part is missing or cannot be parsed.
	 */
	private composeInstant(day: string, time: string): Date | null {
		if (!day || !time) {
			return null;
		}
		const wallClock = `${day} ${time}`;
		const composed = this.timezoneOffset
			? // Parsed in UTC, not the ambient zone. `utcOffset(x, true)` keeps the wall clock and
				// restamps the offset — but a plain `moment(...)` parse happens in whatever zone is
				// ambient first, and `manage-appointment` calls `moment.tz.setDefault(zone)`. A wall
				// clock inside THAT zone's spring-forward gap is normalised an hour later before the
				// restamp ever runs, so the offset is kept and the time is not. UTC has no gaps.
				moment.utc(wallClock, 'YYYY-MM-DD HH:mm').utcOffset(this.timezoneOffset, true)
			: timezone.tz(wallClock, 'YYYY-MM-DD HH:mm', this.timeZoneService.currentTimeZone);
		return composed.isValid() ? composed.toDate() : null;
	}

	/**
	 * How far the displayed zone's UTC offset moves across a calendar day, in minutes.
	 *
	 * Zero on all but two days a year. It is the budget for explaining an inverted pair of clock
	 * readings as a timezone artefact rather than a midnight crossing.
	 *
	 * Measured across the DAY, not between the two composed instants: on a fall-back day both
	 * readings of the repeated hour resolve to the FIRST pass, so the two instants report the same
	 * offset and the change that caused the inversion is invisible from them.
	 *
	 * @param day - Calendar day as `YYYY-MM-DD`.
	 */
	private offsetShiftAcross(day: string): number {
		const dayStart = this.composeInstant(day, '00:00');
		const dayEnd = this.composeInstant(day, '23:59');
		if (!dayStart || !dayEnd) {
			return 0;
		}
		return Math.abs(this.toDisplayZone(dayStart).utcOffset() - this.toDisplayZone(dayEnd).utcOffset());
	}

	/** Wall-clock `HH:mm` as minutes past midnight, or `null` when it is not a time. */
	private static toMinutes(time: string): number | null {
		const parsed = /^(\d{1,2}):(\d{2})$/.exec(time ?? '');
		if (!parsed) return null;
		return Number(parsed[1]) * 60 + Number(parsed[2]);
	}

	/**
	 * The range the picker currently represents — the single source of the value it emits.
	 *
	 * Public so a test can assert the REAL composition rather than re-deriving it: a test that rebuilds
	 * the same `moment`/`timezone.tz` calls passes no matter what this method does.
	 *
	 * @returns The composed range; either end is `null` when its inputs are incomplete.
	 */
	composeRange(): IDateRange {
		const day = moment(this.date).format('YYYY-MM-DD');
		const start = this.composeInstant(day, this.startTime);
		let end = this.composeInstant(day, this.endTime);

		// An end whose CLOCK READING is before the start's crosses midnight: the picker holds one date
		// for both, so that end belongs to the following day. Composed against that day rather than by
		// adding 24 hours, because a DST transition in between makes those different answers.
		//
		// The question is which inversions are REAL. "The composed end is earlier than the composed
		// start" is too weak: an offset change inverts the pair on its own — on a fall-back day 01:30
		// (still DST) to 01:00 (already standard) is a genuine 30-minute log whose instants invert —
		// and rolling that turns half an hour into twenty-four and a half, silently, just from opening
		// the dialog. A fixed threshold is too blunt in the other direction: 02:30 to 00:30 inverts by
		// only two hours and is a perfectly ordinary overnight range.
		//
		// So compare the inversion against the offset change available on that day to explain it — zero
		// on all but two days a year. Beyond that budget the clock cannot account for it and the range
		// really does cross midnight. Equal is left unrolled: genuinely ambiguous, and refusing to save
		// beats writing a day-long log.
		const startMinutes = TimerRangePickerComponent.toMinutes(this.startTime);
		const endMinutes = TimerRangePickerComponent.toMinutes(this.endTime);

		if (start && end && startMinutes !== null && endMinutes !== null) {
			if (startMinutes - endMinutes > this.offsetShiftAcross(day)) {
				end = this.composeInstant(moment(day, 'YYYY-MM-DD').add(1, 'day').format('YYYY-MM-DD'), this.endTime);
			}
		}

		return { start, end };
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
		merge(this.dateModel.valueChanges, this.startTimeModel.valueChanges, this.endTimeModel.valueChanges)
			.pipe(debounceTime(10))
			.subscribe(() => {
				if (this.slotStartTime && this.slotEndTime && this.allowedDuration) {
					this.minSlotStartTime = moment(this.slotStartTime).clone().format('HH:mm');
					this.maxSlotStartTime = moment(this.slotEndTime)
						.clone()
						.subtract(this.allowedDuration, 'minutes')
						.format('HH:mm');
					this.endTime = moment(this.startTime, 'HH:mm').add(this.allowedDuration, 'minutes').format('HH:mm');
				}

				// Composed AFTER the slot adjustment above, which can rewrite `endTime`. Composing first
				// (as this used to) emitted a range whose end did not match the end on screen; it only
				// converged because rewriting `endTime` triggers another valueChanges round.
				this.selectedRange = this.composeRange();
				this.cd.detectChanges();
			});
	}

	/**
	 * Recompute the selectable slot bounds, and seed empty fields, for the day being edited.
	 *
	 * Everything here is in the DISPLAYED zone. It used to be the browser's, which had two costs once
	 * the fields themselves moved to the configured zone: the bounds could exclude the very time on
	 * screen (a zone three hours ahead offered no end slot at or after the value shown, so the user
	 * could not re-pick their own value), and on the create path it PREFILLED start/end from the
	 * browser clock while `composeInstant` then filed those digits as configured-zone wall clock — a
	 * brand-new manual log written at an instant nobody chose.
	 */
	updateTimePickerLimit(date: Date) {
		const now = this.toDisplayZone(new Date());
		let mTime = this.toDisplayZone(date ?? new Date());

		if (mTime.isSame(now, 'day')) {
			mTime = mTime.set({
				hour: now.get('hour'),
				minute: now.get('minute') - (now.minutes() % 10),
				second: 0,
				millisecond: 0
			});
			if (!this.date) {
				// Browser-local midnight of the displayed day: the date input and `composeRange` both
				// read this back with a plain `moment()`, so what has to survive is the calendar day.
				this.date = moment(mTime.format('YYYY-MM-DD'), 'YYYY-MM-DD').toDate();
			}
			if (!this.startTime) {
				this.startTime = mTime.clone().subtract(30, 'minutes').format('HH:mm');
			}
			if (!this.endTime) {
				this.endTime = mTime.format('HH:mm');
			}
		}

		if (mTime.isSame(now, 'day')) {
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

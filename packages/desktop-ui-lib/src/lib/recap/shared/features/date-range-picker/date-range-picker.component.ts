import {
	ChangeDetectionStrategy,
	Component,
	EventEmitter,
	inject,
	Input,
	OnDestroy,
	OnInit,
	Output,
	ViewChild
} from '@angular/core';
import { WeekDaysEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import {
	DaterangepickerDirective as DateRangePickerDirective,
	LocaleConfig,
	DaterangepickerComponent as NgxDateRangePickerComponent
} from 'ngx-daterangepicker-material';
import { BehaviorSubject, Subject } from 'rxjs';
import { debounceTime, tap } from 'rxjs/operators';
import { RecapQuery } from '../../../+state/recap.query';
import { RecapStore } from '../../../+state/recap.store';
import { Arrow } from './arrow/context/arrow.class';
import { Next, Previous } from './arrow/strategies';
import { DateRangeKeyEnum, DateRanges, IDateRangePicker, TimePeriod } from './date-picker.interface';
import { dayOfWeekAsString, shiftUTCtoLocal } from './date-picker.utils';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-date-range-picker',
	templateUrl: './date-range-picker.component.html',
	styleUrls: ['./date-range-picker.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class DateRangePickerComponent implements OnInit, OnDestroy {
	public picker: NgxDateRangePickerComponent;
	public maxDate: string;
	public minDate: string;
	public futureDateAllowed: boolean;
	public ranges: DateRanges; // Define ngx-daterangepicker-material range configuration
	private readonly recapQuery = inject(RecapQuery);
	private readonly dates$: BehaviorSubject<IDateRangePicker> = new BehaviorSubject({
		...this.recapQuery.range,
		isCustomDate: false
	}); // Default selected date picker ranges
	private readonly range$: Subject<IDateRangePicker> = new Subject(); // Local store date picker ranges
	// Declaration of arrow variables
	private arrow: Arrow = new Arrow();
	private next: Next = new Next();
	private previous: Previous = new Previous();

	// Private field to store the locale configuration
	public _locale: LocaleConfig = {
		displayFormat: 'DD.MM.YYYY', // default display format could be 'YYYY-MM-DDTHH:mm:ss.SSSSZ'
		format: 'DD.MM.YYYY', // default format
		direction: 'ltr' // default direction
	};
	// Getter for the locale configuration
	get locale(): LocaleConfig {
		return this._locale;
	}
	// Setter for the locale configuration
	set locale(locale: LocaleConfig) {
		this._locale = locale;
	}

	// Show or Hide arrows button, show by default
	@Input() arrows: boolean = true;

	// Private field to store the first day of the week
	private _firstDayOfWeek: number = moment.localeData().firstDayOfWeek();
	// Getter for the first day of the week
	get firstDayOfWeek(): number {
		return this._firstDayOfWeek;
	}
	// Setter for the first day of the week with input binding
	@Input() set firstDayOfWeek(value: WeekDaysEnum) {
		if (value) this._firstDayOfWeek = dayOfWeekAsString(value);
		this.locale.firstDay = this.firstDayOfWeek;
	}

	/*
	 * Getter & Setter
	 */
	private _timeZone: string = moment.tz.guess();
	get timeZone(): string {
		return this._timeZone;
	}
	@Input() set timeZone(value: string) {
		if (value) this._timeZone = value;
	}

	/*
	 * Getter & Setter for dynamic unitOfTime
	 */
	private _unitOfTime: moment.unitOfTime.Base = 'day';
	public get unitOfTime(): moment.unitOfTime.Base {
		return this._unitOfTime;
	}
	@Input() set unitOfTime(value: moment.unitOfTime.Base) {
		if (value) this._unitOfTime = value;
	}

	/*
	 * Getter & Setter for dynamic selected date range
	 */
	private _selectedDateRange: IDateRangePicker;
	get selectedDateRange(): IDateRangePicker {
		return this._selectedDateRange;
	}
	@Input() set selectedDateRange(range: IDateRangePicker) {
		if (range) {
			this._selectedDateRange = range;
			this.rangePicker = this.selectedDateRange; // Ensure consistency between selectedDateRange and rangePicker
			this.range$.next(range);
		}
	}

	/*
	 * Getter & Setter for dynamic selected internal date range
	 */
	private _rangePicker: IDateRangePicker;
	public get rangePicker(): IDateRangePicker {
		return this._rangePicker;
	}
	public set rangePicker(range: IDateRangePicker) {
		if (range) {
			this._rangePicker = range;
		}
	}

	/*
	 * Getter & Setter for lock date picker
	 */
	private _isLockDatePicker: boolean = false;
	get isLockDatePicker(): boolean {
		return this._isLockDatePicker;
	}
	@Input() set isLockDatePicker(isLock: boolean) {
		this._isLockDatePicker = isLock;
	}

	/*
	 * Getter & Setter for save date picker
	 */
	private _isSaveDatePicker: boolean = false;
	get isSaveDatePicker(): boolean {
		return this._isSaveDatePicker;
	}
	@Input() set isSaveDatePicker(isSave: boolean) {
		this._isSaveDatePicker = isSave;
	}

	/*
	 * Getter & Setter for single date picker
	 */
	private _isSingleDatePicker: boolean = false;
	get isSingleDatePicker(): boolean {
		return this._isSingleDatePicker;
	}
	@Input() set isSingleDatePicker(isSingle: boolean) {
		this._isSingleDatePicker = isSingle;
	}

	/*
	 * Getter & Setter for disabled future dates
	 */
	private _isDisableFutureDatePicker: boolean = false;
	get isDisableFutureDatePicker(): boolean {
		return this._isDisableFutureDatePicker;
	}
	@Input() set isDisableFutureDatePicker(isDisable: boolean) {
		this._isDisableFutureDatePicker = isDisable;
	}

	/**
	 * Getter & Setter for disabled past dates
	 */
	private _isDisablePastDatePicker: boolean = false;
	get isDisablePastDatePicker(): boolean {
		return this._isDisablePastDatePicker;
	}
	@Input() set isDisablePastDatePicker(isDisable: boolean) {
		this._isDisablePastDatePicker = isDisable;
	}

	/** */
	@ViewChild(DateRangePickerDirective, { static: true }) public dateRangePickerDirective: DateRangePickerDirective;

	constructor(public readonly translateService: TranslateService, readonly recapStore: RecapStore) {}

	@Output() rangeChanges = new EventEmitter<IDateRangePicker>();

	@Input()
	public set dates(range: IDateRangePicker) {
		this.dates$.next({
			...range,
			isCustomDate: false
		});
	}

	ngOnInit(): void {
		this.range$
			.pipe(
				distinctUntilChange(),
				debounceTime(500),
				tap((range: IDateRangePicker) => {
					this.rangeChanges.emit({
						startDate: moment(range.startDate).toISOString(),
						endDate: moment(range.endDate).toISOString()
					});
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.selectedDateRange = this.getSelectorDates();
		this.createDateRangeMenus();
		this.setPastStrategy();
		this.setFutureStrategy();
	}

	/**
	 * Create Date Range Translated Menus
	 */
	private createDateRangeMenus() {
		const ranges = {
			day: {
				[DateRangeKeyEnum.TODAY]: [moment().startOf('day'), moment().endOf('day')],
				[DateRangeKeyEnum.YESTERDAY]: [
					moment().subtract(1, 'days').startOf('day'),
					moment().subtract(1, 'days').endOf('day')
				]
			},
			week: {
				[DateRangeKeyEnum.CURRENT_WEEK]: [moment().startOf('isoWeek'), moment().endOf('isoWeek')],
				[DateRangeKeyEnum.LAST_WEEK]: [
					moment().subtract(1, 'week').startOf('isoWeek'),
					moment().subtract(1, 'week').endOf('isoWeek')
				]
			},
			month: {
				[DateRangeKeyEnum.CURRENT_MONTH]: [moment().startOf('month'), moment().endOf('month')],
				[DateRangeKeyEnum.LAST_MONTH]: [
					moment().subtract(1, 'month').startOf('month'),
					moment().subtract(1, 'month').endOf('month')
				]
			}
		};

		this.ranges = this.isLockDatePicker
			? ranges[this.unitOfTime]
			: ({
					...ranges.day,
					...ranges.week,
					...ranges.month
			  } as any as DateRanges);
	}

	/**
	 * Allowed/Disallowed future max date strategy.
	 */
	private setFutureStrategy() {
		if (this.hasFutureStrategy()) {
			this.maxDate = null;
		} else {
			this.maxDate = moment().format();
			if (this.isSameOrAfterDay(this.selectedDateRange.endDate)) {
				this.selectedDateRange = {
					...this.selectedDateRange,
					endDate: moment().toDate()
				};
			}
		}
	}

	/**
	 * Sets the strategy for allowing/disallowing past dates.
	 */
	private setPastStrategy() {
		if (this.hasPastStrategy()) {
			// If there is a past strategy, set the minimum date to the current date
			this.minDate = moment().format();
		} else {
			// If there is no past strategy, set the minimum date to null, allowing past dates
			this.minDate = null;
		}
	}

	/**
	 * Retrieves the next selected range if not disabled.
	 */
	async nextRange() {
		if (this.isNextDisabled()) {
			return;
		}

		this.arrow.setStrategy = this.next;
		const nextRange = this.arrow.execute(this.rangePicker, this.unitOfTime);
		this.selectedDateRange = { ...this.selectedDateRange, ...nextRange };
		this.setFutureStrategy();
	}

	/**
	 * Retrieves the previous selected range.
	 */
	async previousRange() {
		this.arrow.setStrategy = this.previous;
		const previousRange = this.arrow.execute(this.rangePicker, this.unitOfTime);
		this.selectedDateRange = { ...this.selectedDateRange, ...previousRange };
	}

	/**
	 * Checks if the Next Button should be disabled.
	 * @returns True if the Next Button should be disabled, false otherwise.
	 */
	isNextDisabled(): boolean {
		if (!this.selectedDateRange) {
			return true;
		}

		const { startDate, endDate } = this.selectedDateRange;
		if (!startDate || !endDate) {
			return true;
		}

		return !this.hasFutureStrategy() && this.isSameOrAfterDay(endDate);
	}

	/**
	 * Listens to the event on ngx-daterangepicker-material.
	 * @param event The updated time period.
	 */
	onDatesUpdated(event: TimePeriod) {
		if (!this.dateRangePickerDirective) {
			return;
		}

		const { startDate, endDate } = shiftUTCtoLocal(event);
		if (startDate && endDate) {
			const range = {} as IDateRangePicker;
			const start = this.isLockDatePicker ? moment(startDate).startOf(this.unitOfTime) : startDate;
			const end = this.isLockDatePicker ? moment(startDate).endOf(this.unitOfTime) : endDate;

			range.startDate = start.toDate();
			range.endDate = end.toDate();
			range.isCustomDate = this.isCustomDate({
				startDate: start,
				endDate: end
			});

			this.selectedDateRange = range;
		}
	}

	/**
	 * Listens to the range click event on ngx-daterangepicker-material.
	 * @param range The clicked range object.
	 */
	rangeClicked(range: any) {
		const unitOfTimeMap: { [key in DateRangeKeyEnum]: string } = {
			[DateRangeKeyEnum.TODAY]: 'day',
			[DateRangeKeyEnum.YESTERDAY]: 'day',
			[DateRangeKeyEnum.CURRENT_WEEK]: 'week',
			[DateRangeKeyEnum.LAST_WEEK]: 'week',
			[DateRangeKeyEnum.CURRENT_MONTH]: 'month',
			[DateRangeKeyEnum.LAST_MONTH]: 'month'
		};

		const unitOfTime = unitOfTimeMap[range.label];
		if (unitOfTime) {
			this.unitOfTime = unitOfTime;
		}
	}

	/**
	 * Checks if the provided date range is a custom date range.
	 *
	 * @param dateRange The date range to check.
	 * @returns True if the date range is custom, false otherwise.
	 */
	isCustomDate(dateRange: any): boolean {
		if (!this.dateRangePickerDirective) {
			return true; // If dateRangePickerDirective is not available, consider it as a custom range
		}

		const ranges = this.dateRangePickerDirective.ranges;
		for (const range in ranges) {
			if (this.ranges[range]) {
				const [rangeStartDate, rangeEndDate] = this.ranges[range];

				// Create new moment objects for formatted dates to avoid mutation
				const formattedStartDate = moment(dateRange.startDate).clone().format('YYYY-MM-DD');
				const formattedEndDate = moment(dateRange.endDate).clone().format('YYYY-MM-DD');

				const isStartDateEqual = formattedStartDate === rangeStartDate.format('YYYY-MM-DD');
				const isEndDateEqual = formattedEndDate === rangeEndDate.format('YYYY-MM-DD');

				// ignore times when comparing dates if time picker is not enabled
				if (isStartDateEqual && isEndDateEqual) {
					return false; // If the range matches any predefined range, it's not custom
				}
			}
		}
		return true; // If no predefined range matches, it's a custom range
	}

	/**
	 * Is same or after today
	 *
	 * @param date
	 * @returns {Boolean}
	 */
	isSameOrAfterDay(date: string | Date): boolean {
		return moment(moment(date)).isSameOrAfter(moment(), 'day');
	}

	/**
	 * Checks if there is a future strategy or not.
	 * @returns {Boolean} True if there is a future strategy, false otherwise.
	 */
	private hasFutureStrategy(): boolean {
		return !this.isDisableFutureDatePicker && this.futureDateAllowed;
	}

	/**
	 * Determines whether there is a strategy to disable past dates.
	 * @returns {Boolean} True if there is a strategy to disable past dates, otherwise false.
	 */
	private hasPastStrategy(): boolean {
		return this.isDisablePastDatePicker;
	}

	/**
	 * Open Date Picker On Calender Click
	 */
	openDatepicker(event: MouseEvent): void {
		this.dateRangePickerDirective.toggle(event);
	}

	/**
	 * Gets the selector default dates from the BehaviorSubject.
	 *
	 * @returns The default date range picker configuration.
	 */
	private getSelectorDates(): IDateRangePicker {
		const { startDate, endDate, isCustomDate } = this.dates$.getValue();
		return {
			startDate: moment(startDate).toDate(),
			endDate: moment(endDate).toDate(),
			isCustomDate
		};
	}

	ngOnDestroy(): void {}
}

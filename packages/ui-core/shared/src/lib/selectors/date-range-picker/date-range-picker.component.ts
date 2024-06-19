import { Component, OnInit, OnDestroy, AfterViewInit, Input, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, combineLatest, of, Subject, switchMap, take } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	DaterangepickerComponent as NgxDateRangePickerComponent,
	DaterangepickerDirective as DateRangePickerDirective,
	LocaleConfig
} from 'ngx-daterangepicker-material';
import moment from 'moment';
import { TranslateService } from '@ngx-translate/core';
import { IDateRangePicker, IOrganization, ITimeLogFilters, WeekDaysEnum } from '@gauzy/contracts';
import {
	DEFAULT_DATE_PICKER_CONFIG,
	DateRangePickerBuilderService,
	NavigationService,
	OrganizationsService,
	SelectorBuilderService,
	TimesheetFilterService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Store, distinctUntilChange, isNotEmpty } from '@gauzy/ui-core/common';
import { Arrow } from './arrow/context/arrow.class';
import { Next, Previous } from './arrow/strategies';
import { dayOfWeekAsString, shiftUTCtoLocal } from './date-picker.utils';
import { DateRangeKeyEnum, DateRanges, TimePeriod } from './date-picker.interface';
import { TimeZoneService } from '../../timesheet/gauzy-filters/timezone-filter';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-date-range-picker',
	templateUrl: './date-range-picker.component.html',
	styleUrls: ['./date-range-picker.component.scss']
})
export class DateRangePickerComponent extends TranslationBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	public picker: NgxDateRangePickerComponent;
	public organization: IOrganization;
	public maxDate: string;
	public minDate: string;
	public futureDateAllowed: boolean;
	public ranges: DateRanges; // Define ngx-daterangepicker-material range configuration
	private readonly dates$: BehaviorSubject<IDateRangePicker> = this._dateRangePickerBuilderService.dates$; // Default selected date picker ranges
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

		if (this.isSaveDatePicker) {
			this.onSavingFilter(this.getSelectorDates());
		} else {
			this.selectedDateRange = this.getSelectorDates();
			this.rangePicker = this.selectedDateRange; // Ensure consistency between selectedDateRange and rangePicker
		}
	}

	/*
	 * Getter & Setter for dynamic unitOfTime
	 */
	private _unitOfTime: moment.unitOfTime.Base = DEFAULT_DATE_PICKER_CONFIG.unitOfTime;
	get unitOfTime(): moment.unitOfTime.Base {
		return this._unitOfTime;
	}
	@Input() set unitOfTime(value: moment.unitOfTime.Base) {
		if (value) this._unitOfTime = value;

		if (this.isSaveDatePicker) {
			this.onSavingFilter(this.getSelectorDates());
		} else {
			this.selectedDateRange = this.getSelectorDates();
			this.rangePicker = this.selectedDateRange; // Ensure consistency between selectedDateRange and rangePicker
		}
	}

	/*
	 * Getter & Setter for dynamic selected date range
	 */
	private _selectedDateRange: IDateRangePicker;
	get selectedDateRange(): IDateRangePicker {
		return this._selectedDateRange;
	}
	@Input() set selectedDateRange(range: IDateRangePicker) {
		if (isNotEmpty(range)) {
			/**
			 * IF current route has timesheet filter save state
			 */
			if (this.isSaveDatePicker) {
				this._timesheetFilterService.filter = {
					...this._timesheetFilterService.filter,
					...range
				};
			}
			this._selectedDateRange = range;
			this.range$.next(range);

			// Check if the date selector exists
			if (this._selectorBuilderService.getSelectors().date) {
				// Updates the query parameters of the current route without navigating away
				this.navigateWithQueryParams();
			}
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
		if (isNotEmpty(range)) {
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

	constructor(
		public readonly translateService: TranslateService,
		private readonly _route: ActivatedRoute,
		private readonly _store: Store,
		private readonly _organizationService: OrganizationsService,
		private readonly _dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly _timesheetFilterService: TimesheetFilterService,
		private readonly _navigationService: NavigationService,
		private readonly _selectorBuilderService: SelectorBuilderService,
		private readonly _timeZoneService: TimeZoneService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		const storeOrganization$ = this._store.selectedOrganization$;
		const storeDatePickerConfig$ = this._dateRangePickerBuilderService.datePickerConfig$;
		const queryParams$ = this._route.queryParams;

		// Subscribe to the timeZone$ observable
		const timeZone$ = this._timeZoneService.timeZone$.pipe(
			filter((timeZone: string) => !!timeZone),
			tap((timeZone: string) => (this.timeZone = timeZone)),
			tap((timeZone) => {
				// Get the set of US timezones
				const usTimeZones = new Set(moment.tz.zonesForCountry('US'));
				// Determine the date format based on the timezone
				const format = usTimeZones.has(timeZone) ? 'MM.DD.YYYY' : 'DD.MM.YYYY';
				// Update the locale configuration with the new format
				this.locale.displayFormat = format;
				this.locale.format = format;
			})
		);

		combineLatest([storeOrganization$, storeDatePickerConfig$, queryParams$, timeZone$])
			.pipe(
				filter(([organization, datePickerConfig]) => !!organization && !!datePickerConfig),
				switchMap(([organization, datePickerConfig, queryParams, timeZone]) =>
					combineLatest([
						this._organizationService.getById(organization.id, [], {
							id: true,
							futureDateAllowed: true,
							timeZone: true,
							startWeekOn: true
						}),
						of(datePickerConfig),
						of(queryParams), // Emit queryParams as part of the inner observable
						of(timeZone)
					])
				),
				tap(([organization, datePickerConfig, queryParams, timeZone]) => {
					this.organization = organization;
					this.futureDateAllowed = organization.futureDateAllowed;
					this.timeZone = timeZone;

					const { isLockDatePicker, isSaveDatePicker } = datePickerConfig;
					const { isSingleDatePicker, isDisableFutureDate, isDisablePastDate } = datePickerConfig;

					this.isDisableFutureDatePicker = isDisableFutureDate;
					this.isDisablePastDatePicker = isDisablePastDate;
					this.isLockDatePicker = isLockDatePicker;
					this.isSaveDatePicker = isSaveDatePicker;
					this.isSingleDatePicker = isSingleDatePicker;

					const { unit_of_time = datePickerConfig.unitOfTime } = queryParams;
					this.unitOfTime = unit_of_time;
				}),
				tap(() => {
					this.createDateRangeMenus();
					this.setPastStrategy();
					this.setFutureStrategy();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.range$
			.pipe(
				distinctUntilChange(),
				tap((range: IDateRangePicker) => {
					this._dateRangePickerBuilderService.selectedDateRange = range;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Create Date Range Translated Menus
	 */
	createDateRangeMenus() {
		this.ranges = {
			[DateRangeKeyEnum.TODAY]: [moment(), moment()],
			[DateRangeKeyEnum.YESTERDAY]: [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
			[DateRangeKeyEnum.CURRENT_WEEK]: [moment().startOf('week'), moment().endOf('week')],
			[DateRangeKeyEnum.LAST_WEEK]: [
				moment().subtract(1, 'week').startOf('week'),
				moment().subtract(1, 'week').endOf('week')
			],
			[DateRangeKeyEnum.CURRENT_MONTH]: [moment().startOf('month'), moment().endOf('month')],
			[DateRangeKeyEnum.LAST_MONTH]: [
				moment().subtract(1, 'month').startOf('month'),
				moment().subtract(1, 'month').endOf('month')
			]
		};

		// Define the units of time to remove based on conditions
		const unitsToRemove = [];

		if (this.isLockDatePicker && this.unitOfTime !== 'day') {
			unitsToRemove.push(DateRangeKeyEnum.TODAY, DateRangeKeyEnum.YESTERDAY);
		}
		if (this.isLockDatePicker && this.unitOfTime !== 'week') {
			unitsToRemove.push(DateRangeKeyEnum.CURRENT_WEEK, DateRangeKeyEnum.LAST_WEEK);
		}
		if (this.isLockDatePicker && this.unitOfTime !== 'month') {
			unitsToRemove.push(DateRangeKeyEnum.CURRENT_MONTH, DateRangeKeyEnum.LAST_MONTH);
		}

		// Remove date ranges based on unitsToRemove
		unitsToRemove.forEach((unit) => {
			delete this.ranges[unit];
		});
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
		this.rangePicker = this.selectedDateRange; // Ensure consistency between selectedDateRange and rangePicker
		this.setFutureStrategy();
	}

	/**
	 * Retrieves the previous selected range.
	 */
	async previousRange() {
		this.arrow.setStrategy = this.previous;
		const previousRange = this.arrow.execute(this.rangePicker, this.unitOfTime);
		this.selectedDateRange = { ...this.selectedDateRange, ...previousRange };
		this.rangePicker = this.selectedDateRange; // Ensure consistency between selectedDateRange and rangePicker
	}

	/**
	 * Navigates to the current route with specified query parameters, while preserving existing ones.
	 *
	 * @param queryParams The query parameters to be attached.
	 */
	async navigateWithQueryParams(): Promise<void> {
		const { startDate, endDate, isCustomDate } = this.selectedDateRange;

		// Create new moment objects for formatted dates to avoid mutation
		const formattedStartDate = moment(startDate).clone().format('YYYY-MM-DD');
		const formattedEndDate = moment(endDate).clone().format('YYYY-MM-DD');

		// Updates the query parameters of the current route without navigating away.
		await this._navigationService.updateQueryParams({
			date: formattedStartDate,
			date_end: formattedEndDate,
			unit_of_time: this.unitOfTime,
			is_custom_date: isCustomDate
		});
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
			this.rangePicker = this.selectedDateRange; // Ensure consistency between selectedDateRange and rangePicker
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
	 * When date range picker wants to save dates in local storage
	 *
	 * @param range
	 */
	onSavingFilter(range: IDateRangePicker) {
		this._timesheetFilterService.filter$
			.pipe(
				take(1),
				filter(() => !!this.isSaveDatePicker),
				tap((filters: ITimeLogFilters) => {
					const { startDate = range.startDate } = filters;
					const hasFutureStrategy = this.hasFutureStrategy();
					const date = !hasFutureStrategy && this.isSameOrAfterDay(startDate) ? moment() : moment(startDate);
					const start = moment(date).startOf(this.unitOfTime);
					const end = moment(date).endOf(this.unitOfTime);

					this.selectedDateRange = {
						startDate: start.toDate(),
						endDate: end.toDate(),
						isCustomDate: this.isCustomDate({ startDate: start, endDate: end })
					};
					this.rangePicker = this.selectedDateRange; // Ensure consistency between selectedDateRange and rangePicker
				}),
				untilDestroyed(this)
			)
			.subscribe();
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

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
	Store,
	TimesheetFilterService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { distinctUntilChange, isNotEmpty } from '@gauzy/ui-core/common';
import { Arrow } from './arrow/context/arrow.class';
import { Next, Previous } from './arrow/strategies';
import { dayOfWeekAsString, shiftUTCtoLocal } from './date-picker.utils';
import { DateRangeClicked, DateRangeKeyEnum, DateRanges, TimePeriod } from './date-picker.interface';
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

	/**
	 * Locale configuration for the component.
	 * Defaults are:
	 * - displayFormat: 'DD.MM.YYYY'
	 * - format: 'DD.MM.YYYY'
	 * - direction: 'ltr'
	 */
	public locale: LocaleConfig = {
		displayFormat: 'DD.MM.YYYY', // Default display format
		format: 'DD.MM.YYYY', // Default format
		direction: 'ltr' // Default direction
	};

	/** ViewChild for the DateRangePickerDirective */
	@ViewChild(DateRangePickerDirective, { static: true }) public dateRangePickerDirective: DateRangePickerDirective;

	/**
	 * Determines whether to show or hide the arrows button.
	 * Defaults to showing the arrows.
	 */
	@Input() arrows: boolean = true;

	/**
	 * Indicates whether the date picker is locked.
	 */
	@Input() isLockDatePicker: boolean = false;

	/**
	 * Indicates whether the date picker is in single date selection mode.
	 */
	@Input() isSingleDatePicker: boolean = false;

	/**
	 * Indicates whether future dates are disabled in the date picker.
	 */
	@Input() isDisableFutureDatePicker: boolean = false;

	/**
	 * Indicates whether past dates are disabled in the date picker.
	 */
	@Input() isDisablePastDatePicker: boolean = false;

	/**
	 * The first day of the week.
	 */
	private _firstDayOfWeek: number = moment.localeData().firstDayOfWeek();
	@Input() set firstDayOfWeek(value: WeekDaysEnum) {
		// Accept zero (Sunday) as a valid value
		if (value !== null && value !== undefined) {
			this._firstDayOfWeek = dayOfWeekAsString(value);
		} else {
			// Default to locale's first day of the week if value is null or undefined
			this._firstDayOfWeek = moment.localeData().firstDayOfWeek();
		}
		this.locale.firstDay = this._firstDayOfWeek;
	}
	get firstDayOfWeek(): number {
		return this._firstDayOfWeek;
	}

	/**
	 * The time zone to be used.
	 * Defaults to the user's local time zone.
	 */
	private _timeZone: string = moment.tz.guess();
	@Input() set timeZone(value: string | null | undefined) {
		// Update the time zone if a valid value is provided
		if (value) {
			this._timeZone = value;
		}

		// Get the date picker configuration
		const datePickerConfig = this._dateRangePickerBuilderService.datePickerConfig;
		// Update the date picker based on the current settings
		const selectorDates = this.getSelectorDates();
		// If the date picker is set to save date range, save the selected date range
		if (datePickerConfig.isSaveDatePicker) {
			this.onSavingFilter(selectorDates);
		} else {
			this.selectedDateRange = selectorDates;
			this.rangePicker = { ...selectorDates }; // Ensure consistency between selectedDateRange and rangePicker
		}
	}
	get timeZone(): string {
		return this._timeZone;
	}

	/**
	 * Dynamic unit of time for date operations.
	 * Defaults to the configuration's unit of time if not provided.
	 */
	private _unitOfTime: moment.unitOfTime.Base = DEFAULT_DATE_PICKER_CONFIG.unitOfTime;
	@Input() set unitOfTime(value: moment.unitOfTime.Base | null | undefined) {
		// Update _unitOfTime if a valid value is provided; otherwise, use default
		if (value !== null && value !== undefined) {
			this._unitOfTime = value;
		} else {
			this._unitOfTime = DEFAULT_DATE_PICKER_CONFIG.unitOfTime;
		}

		// Get the date picker configuration
		const datePickerConfig = this._dateRangePickerBuilderService.datePickerConfig;
		// Update the date picker based on the current settings
		const selectorDates = this.getSelectorDates();
		// If the date picker is set to save date range, save the selected date range
		if (datePickerConfig.isSaveDatePicker) {
			this.onSavingFilter(selectorDates);
		} else {
			this.selectedDateRange = selectorDates;
			this.rangePicker = { ...selectorDates }; // Ensure consistency between selectedDateRange and rangePicker
		}
	}
	get unitOfTime(): moment.unitOfTime.Base {
		return this._unitOfTime;
	}

	/**
	 * Getter and Setter for dynamic selected date range.
	 */
	private _selectedDateRange: IDateRangePicker;
	@Input() set selectedDateRange(range: IDateRangePicker) {
		if (isNotEmpty(range)) {
			// Get the date picker configuration
			const datePickerConfig = this._dateRangePickerBuilderService.datePickerConfig;
			// If the current route has timesheet filter save state
			if (datePickerConfig.isSaveDatePicker) {
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
	get selectedDateRange(): IDateRangePicker {
		return this._selectedDateRange;
	}

	/**
	 * Getter and Setter for the dynamic selected internal date range.
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
					this.organization = organization; // Update the organization
					this.futureDateAllowed = organization.futureDateAllowed; // Update the future date allowed
					this.timeZone = timeZone; // Update the time zone

					const { isLockDatePicker } = datePickerConfig;
					const { isSingleDatePicker, isDisableFutureDate, isDisablePastDate } = datePickerConfig;

					this.isDisableFutureDatePicker = isDisableFutureDate;
					this.isDisablePastDatePicker = isDisablePastDate;
					this.isLockDatePicker = isLockDatePicker;
					this.isSingleDatePicker = isSingleDatePicker;

					const { unit_of_time: unitOfTime = datePickerConfig.unitOfTime } = queryParams;
					this.unitOfTime = unitOfTime;
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
	 * Creates the date range translated menus based on the current configuration.
	 */
	createDateRangeMenus(): void {
		this.ranges = {};

		// Helper function to add ranges to the ranges object
		const addRange = (key: DateRangeKeyEnum, startDate: moment.Moment, endDate: moment.Moment) => {
			this.ranges[key] = [startDate, endDate];
		};

		// Determine which units of time are allowed
		const allowedUnits = this.isLockDatePicker ? [this.unitOfTime] : ['day', 'week', 'month'];

		// Add date ranges based on the allowed units of time
		allowedUnits.forEach((unit) => {
			switch (unit) {
				case 'day':
					addRange(DateRangeKeyEnum.TODAY, moment(), moment());
					addRange(DateRangeKeyEnum.YESTERDAY, moment().subtract(1, 'days'), moment().subtract(1, 'days'));
					break;
				case 'week':
					addRange(DateRangeKeyEnum.CURRENT_WEEK, moment().startOf('week'), moment().endOf('week'));
					addRange(
						DateRangeKeyEnum.LAST_WEEK,
						moment().subtract(1, 'week').startOf('week'),
						moment().subtract(1, 'week').endOf('week')
					);
					break;
				case 'month':
					addRange(DateRangeKeyEnum.CURRENT_MONTH, moment().startOf('month'), moment().endOf('month'));
					addRange(
						DateRangeKeyEnum.LAST_MONTH,
						moment().subtract(1, 'month').startOf('month'),
						moment().subtract(1, 'month').endOf('month')
					);
					break;
			}
		});
	}

	/**
	 * Updates the maximum selectable date based on the future date strategy.
	 * If future dates are allowed, `maxDate` is set to `null` (no maximum limit).
	 * If future dates are disallowed, `maxDate` is set to today.
	 * Additionally, if the selected end date is in the future, it is adjusted to today.
	 */
	private setFutureStrategy(): void {
		if (this.hasFutureStrategy()) {
			// Future dates are allowed; no maximum date limit
			this.maxDate = null;
		} else {
			// Future dates are disallowed; set maxDate to today
			const today = moment();
			this.maxDate = today.format();

			// If the selected end date is today or in the future, adjust it to today
			if (this.isSameOrAfterDay(this.selectedDateRange.endDate)) {
				this.selectedDateRange = {
					...this.selectedDateRange,
					endDate: today.toDate()
				};
			}
		}
	}

	/**
	 * Updates the minimum selectable date based on the past date strategy.
	 * If past dates are disallowed, `minDate` is set to today.
	 * If past dates are allowed, `minDate` is set to `null` (no minimum limit).
	 */
	private setPastStrategy(): void {
		if (this.hasPastStrategy()) {
			// Past dates are disallowed; set minDate to today
			this.minDate = moment().format();
		} else {
			// Past dates are allowed; no minimum date limit
			this.minDate = null;
		}
	}

	/**
	 * Advances the selected date range to the next period if not disabled.
	 * Updates the selected date range and synchronizes the range picker.
	 * Also updates the query parameters without navigating away.
	 */
	async nextRange(): Promise<void> {
		if (this.isNextDisabled()) {
			return;
		}

		// Set the strategy to 'next' on the arrow object
		this.arrow.setStrategy(this.next);

		// Execute the strategy to get the next range
		const nextRange = this.arrow.execute(this.rangePicker, this.unitOfTime);

		// Update the selected date range and ensure consistency with the range picker
		this.selectedDateRange = { ...nextRange };
		this.rangePicker = { ...nextRange };

		// Update future strategy settings if necessary
		this.setFutureStrategy();
	}

	/**
	 * Moves the selected date range to the previous period.
	 * Updates the selected date range and synchronizes the range picker.
	 * Also updates the query parameters without navigating away.
	 */
	previousRange(): void {
		// Set the strategy to 'previous' on the arrow object
		this.arrow.setStrategy(this.previous);

		// Execute the strategy to get the previous range
		const previousRange = this.arrow.execute(this.rangePicker, this.unitOfTime);

		// Update the selected date range and ensure consistency with the range picker
		this.selectedDateRange = { ...previousRange };
		this.rangePicker = { ...previousRange };
	}

	/**
	 * Determines whether the "Next" button should be disabled.
	 * The "Next" button is disabled if:
	 * - There is no selected date range.
	 * - The selected date range lacks a start or end date.
	 * - There is no future strategy available and the end date is today or in the past.
	 *
	 * @returns {boolean} True if the Next Button should be disabled, false otherwise.
	 */
	isNextDisabled(): boolean {
		// Check if selectedDateRange, startDate, and endDate are all defined
		if (!this.selectedDateRange?.startDate || !this.selectedDateRange?.endDate) {
			return true;
		}

		// Determine if there is no future strategy and the end date is today or after
		return !this.hasFutureStrategy() && this.isSameOrAfterDay(this.selectedDateRange.endDate);
	}

	/**
	 * Listens to the date update event from ngx-daterangepicker-material.
	 * Updates the selected date range and synchronizes the range picker.
	 * Also updates the query parameters without navigating away.
	 *
	 * @param event - The updated time period.
	 */
	onDatesUpdated(event: TimePeriod): void {
		if (!this.dateRangePickerDirective) {
			return;
		}

		const { startDate, endDate } = shiftUTCtoLocal(event);

		// Return early if either date is missing
		if (!startDate || !endDate) {
			return;
		}

		// Ensure start and end are moment objects
		const startMoment = this.isLockDatePicker ? moment(startDate).startOf(this.unitOfTime) : moment(startDate);
		const endMoment = this.isLockDatePicker ? moment(startDate).endOf(this.unitOfTime) : moment(endDate);

		// Construct the range object directly
		const range: IDateRangePicker = {
			startDate: startMoment.toDate(),
			endDate: endMoment.toDate(),
			isCustomDate: this.isCustomDate({ startDate: startMoment, endDate: endMoment })
		};

		// Update the selected date range and ensure consistency with the range picker
		this.selectedDateRange = { ...range };
		this.rangePicker = { ...range };
	}

	/**
	 * Handles the range click event from ngx-daterangepicker-material.
	 * Updates the `unitOfTime` based on the selected range label.
	 *
	 * @param {DateRangeClicked} range - The clicked range object.
	 */
	rangeClicked(range: DateRangeClicked) {
		// Define the mapping outside the method to avoid recreating it on every call
		const unitOfTimeMap: Record<string, moment.unitOfTime.Base> = {
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
		} else {
			console.warn(`Unrecognized range label: ${range.label}`);
		}
	}

	/**
	 * Determines if the provided date range is a custom date range,
	 * meaning it does not match any predefined ranges.
	 *
	 * @param dateRange - The date range to check.
	 * @returns True if the date range is custom, false otherwise.
	 */
	isCustomDate(dateRange: { startDate: moment.Moment; endDate: moment.Moment }): boolean {
		// If the date range picker directive or its ranges are not available, consider it a custom range
		if (!this.dateRangePickerDirective?.ranges) {
			return true;
		}

		const predefinedRanges = this.dateRangePickerDirective.ranges;
		const formattedStartDate = moment(dateRange.startDate).format('YYYY-MM-DD');
		const formattedEndDate = moment(dateRange.endDate).format('YYYY-MM-DD');

		// Iterate over the predefined ranges to check for a match
		for (const rangeLabel in predefinedRanges) {
			if (predefinedRanges.hasOwnProperty(rangeLabel)) {
				const [rangeStartDate, rangeEndDate] = predefinedRanges[rangeLabel];

				// Format the predefined range dates for comparison
				const predefinedStartDate = rangeStartDate.format('YYYY-MM-DD');
				const predefinedEndDate = rangeEndDate.format('YYYY-MM-DD');

				// Compare the formatted dates
				if (formattedStartDate === predefinedStartDate && formattedEndDate === predefinedEndDate) {
					// The date range matches a predefined range; it's not custom
					return false;
				}
			}
		}

		// No matching predefined range found; it's a custom date range
		return true;
	}

	/**
	 * Saves the selected date range to the timesheet filter service and updates the query parameters.
	 *
	 * @param range - The selected date range.
	 */
	onSavingFilter(range: IDateRangePicker): void {
		const datePickerConfig = this._dateRangePickerBuilderService.datePickerConfig;

		// Proceed only if saving the date picker is enabled
		if (!datePickerConfig.isSaveDatePicker) {
			return;
		}

		// Subscribe to the filter$ Observable and take the first emitted value
		this._timesheetFilterService.filter$
			.pipe(take(1), untilDestroyed(this))
			.subscribe((filters: ITimeLogFilters) => {
				// Use the startDate from filters if available; otherwise, use the startDate from the range parameter
				const startDate = filters.startDate || range.startDate;

				// Determine if future dates are allowed
				const hasFutureStrategy = this.hasFutureStrategy();

				// Calculate the date based on the future strategy and the start date
				const dateMoment =
					!hasFutureStrategy && this.isSameOrAfterDay(startDate) ? moment() : moment(startDate);

				// Get the start and end of the unit of time (e.g., day, week, month)
				const start = dateMoment.clone().startOf(this.unitOfTime);
				const end = dateMoment.clone().endOf(this.unitOfTime);

				// Update the selected date range and ensure consistency with the range picker
				this.selectedDateRange = {
					startDate: start.toDate(),
					endDate: end.toDate(),
					isCustomDate: this.isCustomDate({ startDate: start, endDate: end })
				};
				this.rangePicker = { ...this.selectedDateRange }; // Ensure consistency between selectedDateRange and rangePicker
			});
	}

	/**
	 * Checks if the provided date is the same as or after today.
	 *
	 * @param date - The date to compare.
	 * @returns True if the date is today or in the future, false otherwise.
	 */
	isSameOrAfterDay(date: string | Date): boolean {
		return moment(date).isSameOrAfter(moment(), 'day');
	}

	/**
	 * Determines whether future dates are allowed based on the current strategy.
	 *
	 * @returns True if future dates are allowed, false otherwise.
	 */
	private hasFutureStrategy(): boolean {
		return !this.isDisableFutureDatePicker && this.futureDateAllowed;
	}

	/**
	 * Determines whether past dates are disallowed based on the current strategy.
	 *
	 * @returns True if past dates are disallowed, false otherwise.
	 */
	private hasPastStrategy(): boolean {
		return this.isDisablePastDatePicker;
	}

	/**
	 * Opens the date picker when the calendar icon is clicked.
	 *
	 * @param event - The mouse event triggered by clicking the calendar icon.
	 */
	openDatepicker(event: MouseEvent): void {
		if (this.dateRangePickerDirective) {
			this.dateRangePickerDirective.toggle(event);
		} else {
			console.warn('DateRangePickerDirective is not initialized.');
		}
	}

	/**
	 * Retrieves the default date range picker configuration from the dates BehaviorSubject.
	 *
	 * @returns The default date range picker configuration.
	 */
	private getSelectorDates(): IDateRangePicker {
		const { startDate, endDate, isCustomDate } = this.dates$.getValue();

		return {
			startDate: moment(startDate).toDate(),
			endDate: moment(endDate).toDate(),
			isCustomDate: isCustomDate ?? false
		};
	}

	/**
	 * Navigates to the current route with specified query parameters, while preserving existing ones.
	 *
	 * @param queryParams The query parameters to be attached.
	 */
	async navigateWithQueryParams(): Promise<void> {
		const selectors = this._selectorBuilderService.getSelectors();

		// Check if the date selector exists
		if (selectors.date) {
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
	}

	ngOnDestroy(): void {}
}

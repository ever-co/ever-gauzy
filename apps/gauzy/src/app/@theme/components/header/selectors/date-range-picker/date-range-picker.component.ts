import { Component, OnInit, OnDestroy, AfterViewInit, Input, ViewChild } from '@angular/core';
import { BehaviorSubject, combineLatest, of as observableOf, Subject, switchMap, take } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	DaterangepickerComponent as NgxDateRangePickerComponent,
	DaterangepickerDirective as DateRangePickerDirective,
	LocaleConfig
} from 'ngx-daterangepicker-material';
import * as moment from 'moment';
import { IDateRangePicker, IOrganization, ITimeLogFilters, WeekDaysEnum } from '@gauzy/contracts';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import { TranslateService } from '@ngx-translate/core';
import { OrganizationsService, Store } from './../../../../../@core/services';
import { Arrow } from './arrow/context/arrow.class';
import { Next, Previous } from './arrow/strategies';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { dayOfWeekAsString, shiftUTCtoLocal } from './date-picker.utils';
import { DateRangeKeyEnum, DateRanges, TimePeriod } from './date-picker.interface';
import { TimesheetFilterService } from './../../../../../@shared/timesheet/timesheet-filter.service';
import { DEFAULT_DATE_PICKER_CONFIG, DateRangePickerBuilderService } from '@gauzy/ui-sdk/core';

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
	public futureDateAllowed: boolean;

	/**
	 * Default selected date picker ranges
	 */
	private readonly dates$: BehaviorSubject<IDateRangePicker> = this.dateRangePickerBuilderService.dates$;
	/**
	 * Local store date picker ranges
	 */
	private readonly range$: Subject<IDateRangePicker> = new Subject();

	/**
	 * declaration of arrow variables
	 */
	private arrow: Arrow = new Arrow();
	private next: Next = new Next();
	private previous: Previous = new Previous();

	/**
	 * ngx-daterangepicker-material local configuration
	 */
	public _locale: LocaleConfig = {
		displayFormat: 'DD.MM.YYYY', // could be 'YYYY-MM-DDTHH:mm:ss.SSSSZ'
		format: 'DD.MM.YYYY', // default is format value
		direction: 'ltr',
		firstDay:
			dayOfWeekAsString(this.store?.selectedOrganization?.startWeekOn || WeekDaysEnum.MONDAY) ||
			moment.localeData().firstDayOfWeek()
	};
	get locale(): LocaleConfig {
		return this._locale;
	}
	set locale(locale: LocaleConfig) {
		this._locale = locale;
	}

	/**
	 * Define ngx-daterangepicker-material range configuration
	 */
	public ranges: DateRanges;

	/**
	 * show or hide arrows button, show by default
	 */
	@Input()
	arrows: boolean = true;

	/*
	 * Getter & Setter for dynamic unitOfTime
	 */
	private _unitOfTime: moment.unitOfTime.Base = DEFAULT_DATE_PICKER_CONFIG.unitOfTime;
	get unitOfTime(): moment.unitOfTime.Base {
		return this._unitOfTime;
	}
	@Input() set unitOfTime(unitOfTime: moment.unitOfTime.Base) {
		if (unitOfTime) {
			this._unitOfTime = unitOfTime;
		}
		if (this.isSaveDatePicker) {
			this.onSavingFilter(this.getSelectorDates());
		} else {
			this.selectedDateRange = this.rangePicker = this.getSelectorDates();
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
				this.timesheetFilterService.filter = {
					...this.timesheetFilterService.filter,
					...range
				};
			}
			this._selectedDateRange = range;
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

	/** */
	@ViewChild(DateRangePickerDirective, { static: true }) public dateRangePickerDirective: DateRangePickerDirective;

	constructor(
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly organizationService: OrganizationsService,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly timesheetFilterService: TimesheetFilterService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeDatePickerConfig$ = this.dateRangePickerBuilderService.datePickerConfig$;

		combineLatest([storeOrganization$, storeDatePickerConfig$])
			.pipe(
				filter(([organization, datePickerConfig]) => !!organization && !!datePickerConfig),
				switchMap(([organization, datePickerConfig]) =>
					combineLatest([
						this.organizationService.getById(organization.id, [], {
							id: true,
							futureDateAllowed: true,
							timeZone: true,
							startWeekOn: true
						}),
						observableOf(datePickerConfig)
					])
				),
				tap(([organization]) => {
					if (organization.timeZone) {
						let format: string;
						if (moment.tz.zonesForCountry('US').includes(organization.timeZone)) {
							format = 'MM.DD.YYYY';
						} else {
							format = 'DD.MM.YYYY';
						}
						this.locale.displayFormat = format;
						this.locale.format = format;
					}
				}),
				tap(([organization, datePickerConfig]) => {
					this.organization = organization;
					this.futureDateAllowed = organization.futureDateAllowed;

					const { unitOfTime, isLockDatePicker, isSaveDatePicker } = datePickerConfig;
					const { isSingleDatePicker, isDisableFutureDate } = datePickerConfig;

					this.isDisableFutureDatePicker = isDisableFutureDate;
					this.isLockDatePicker = isLockDatePicker;
					this.isSaveDatePicker = isSaveDatePicker;
					this.isSingleDatePicker = isSingleDatePicker;
					this.unitOfTime = unitOfTime;
				}),
				tap(() => {
					this.createDateRangeMenus();
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
					this.dateRangePickerBuilderService.selectedDateRange = range;
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
	 * get next selected range
	 */
	nextRange() {
		if (this.isNextDisabled()) {
			return;
		}
		this.arrow.setStrategy = this.next;
		const nextRange = this.arrow.execute(this.rangePicker, this.unitOfTime);
		this.selectedDateRange = this.rangePicker = {
			...this.selectedDateRange,
			...nextRange
		};
		this.setFutureStrategy();
	}

	/**
	 * get previous selected range
	 */
	previousRange() {
		this.arrow.setStrategy = this.previous;
		const previousRange = this.arrow.execute(this.rangePicker, this.unitOfTime);
		this.selectedDateRange = this.rangePicker = {
			...this.selectedDateRange,
			...previousRange
		};
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
	 * listen event on ngx-daterangepicker-material
	 * @param event
	 */
	onDatesUpdated(event: TimePeriod) {
		if (this.dateRangePickerDirective) {
			const { startDate, endDate } = shiftUTCtoLocal(event);
			if (startDate && endDate) {
				const range = {} as IDateRangePicker;
				if (!this.isLockDatePicker) {
					range['startDate'] = startDate.toDate();
					range['endDate'] = endDate.toDate();
					range['isCustomDate'] = this.isCustomDate(event);
				} else {
					const start = moment(startDate.toDate()).startOf(this.unitOfTime);
					const end = moment(startDate.toDate()).endOf(this.unitOfTime);
					range['startDate'] = start.toDate();
					range['endDate'] = end.toDate();
					range['isCustomDate'] = this.isCustomDate({
						startDate: start,
						endDate: end
					});
				}
				this.selectedDateRange = this.rangePicker = range;
			}
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
	 * Check is custom date
	 *
	 * @param dateRange
	 * @returns
	 */
	isCustomDate(dateRange: any): boolean {
		let isCustomRange = true;
		if (this.dateRangePickerDirective) {
			const ranges = this.dateRangePickerDirective.ranges;
			for (const range in ranges) {
				if (this.ranges[range]) {
					const [startDate, endDate] = this.ranges[range];
					// ignore times when comparing dates if time picker is not enabled
					if (
						dateRange.startDate.format('YYYY-MM-DD') === startDate.format('YYYY-MM-DD') &&
						dateRange.endDate.format('YYYY-MM-DD') === endDate.format('YYYY-MM-DD')
					) {
						isCustomRange = false;
						break;
					}
				}
			}
		}
		return isCustomRange;
	}

	/**
	 * When date range picker wants to save dates in local storage
	 *
	 * @param range
	 */
	onSavingFilter(range: IDateRangePicker) {
		this.timesheetFilterService.filter$
			.pipe(
				take(1),
				filter(() => !!this.isSaveDatePicker),
				tap((filters: ITimeLogFilters) => {
					const { startDate = range.startDate } = filters;
					const date =
						!this.hasFutureStrategy() && this.isSameOrAfterDay(startDate) ? moment() : moment(startDate);

					const start = moment(date).startOf(this.unitOfTime);
					const end = moment(date).endOf(this.unitOfTime);

					this.selectedDateRange = this.rangePicker = {
						startDate: start.toDate(),
						endDate: end.toDate(),
						isCustomDate: this.isCustomDate({
							startDate: start,
							endDate: end
						})
					};
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

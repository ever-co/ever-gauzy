import { Component, OnInit, OnDestroy, AfterViewInit, Input, ViewChild } from '@angular/core';
import { combineLatest, debounceTime, of as observableOf, Subject, switchMap, take } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DaterangepickerDirective as DateRangePickerDirective, LocaleConfig } from 'ngx-daterangepicker-material';
import * as moment from 'moment';
import { IDateRangePicker, IOrganization, ITimeLogFilters, WeekDaysEnum } from '@gauzy/contracts';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import { TranslateService } from '@ngx-translate/core';
import { DateRangePickerBuilderService, DEFAULT_DATE_PICKER_CONFIG, OrganizationsService, Store } from './../../../../../@core/services';
import { Arrow } from './arrow/context/arrow.class';
import { Next, Previous } from './arrow/strategies';
import { TranslationBaseComponent } from './../../../../../@shared/language-base';
import { DateRangeKeyEnum, dayOfWeekAsString } from './date-range-picker.setting';
import { TimesheetFilterService } from './../../../../../@shared/timesheet/timesheet-filter.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-date-range-picker',
	templateUrl: './date-range-picker.component.html',
	styleUrls: ['./date-range-picker.component.scss']
})
export class DateRangePickerComponent extends TranslationBaseComponent 
	implements AfterViewInit, OnInit, OnDestroy {

	public organization: IOrganization; 
	public maxDate: string;
	public futureDateAllowed: boolean;

	/**
	 * Local store date range 
	 */
	private range$: Subject<IDateRangePicker> = new Subject();

	/**
	 * declaration of arrow variables
	 */
	private arrow: Arrow = new Arrow();
	private next: Next = new Next();
	private previous: Previous = new Previous();

	/**
	 * ngx-daterangepicker-material local configuration
	 */
	_locale: LocaleConfig = {
		displayFormat: 'DD.MM.YYYY', // could be 'YYYY-MM-DDTHH:mm:ss.SSSSZ'
		format: 'DD.MM.YYYY', // default is format value
		direction: 'ltr',
		firstDay: dayOfWeekAsString(WeekDaysEnum.MONDAY)
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
	public ranges: any;

	/**
	 * show or hide arrows button, show by default
	 */
	@Input()
	arrows: boolean = true;

	/*
	* Getter & Setter for dynamic unitOfTime
	*/
	_unitOfTime: moment.unitOfTime.Base = DEFAULT_DATE_PICKER_CONFIG.unitOfTime;
	get unitOfTime(): moment.unitOfTime.Base {
		return this._unitOfTime;
	}
	@Input() set unitOfTime(value: moment.unitOfTime.Base) {
		if (value) {
			this._unitOfTime = value;
		}
		const start = moment().startOf(this.unitOfTime);
		const end = moment().endOf(this.unitOfTime);
		const range = {
			startDate: start.toDate(),
			endDate: end.toDate(),
			isCustomDate: this.isCustomDate({
				startDate: start,
				endDate: end
			})
		}
		if (this.isSaveDatePicker) {
			this.onSavingFilter(range);
		} else {
			this.selectedDateRange = this.rangePicker = range;
		}
	}

	/*
	* Getter & Setter for dynamic selected date range
	*/
	_selectedDateRange: IDateRangePicker;
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
				}
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
	_isLockDatePicker: boolean = false;
	get isLockDatePicker(): boolean {
		return this._isLockDatePicker;
	}
	@Input() set isLockDatePicker(isLock: boolean) {
		this._isLockDatePicker = isLock;
	}

	/*
	* Getter & Setter for save date picker
	*/
	_isSaveDatePicker: boolean = false;
	get isSaveDatePicker(): boolean {
		return this._isSaveDatePicker;
	}
	@Input() set isSaveDatePicker(isSave: boolean) {
		this._isSaveDatePicker = isSave;
	}

	/*
	* Getter & Setter for single date picker
	*/
	_isSingleDatePicker: boolean = false;
	get isSingleDatePicker(): boolean {
		return this._isSingleDatePicker;
	}
	@Input() set isSingleDatePicker(isSingle: boolean) {
		this._isSingleDatePicker = isSingle;
	}

	/*
	* Getter & Setter for disabled future dates
	*/
	_isDisableFutureDatePicker: boolean = false;
	get isDisableFutureDatePicker(): boolean {
		return this._isDisableFutureDatePicker;
	}
	@Input() set isDisableFutureDatePicker(isDisable: boolean) {
		this._isDisableFutureDatePicker = isDisable;
	}

	@ViewChild(DateRangePickerDirective, { static: false }) dateRangePickerDirective: DateRangePickerDirective;

	constructor(
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly organizationService: OrganizationsService,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly timesheetFilterService: TimesheetFilterService,
	) {
		super(translateService);
	}

	ngOnInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeDatePickerConfig$ = this.dateRangePickerBuilderService.datePickerConfig$;

		combineLatest([storeOrganization$, storeDatePickerConfig$])
			.pipe(
				debounceTime(100),
				filter(([organization, datePickerConfig]) => !!organization && !!datePickerConfig),
				switchMap(([organization, datePickerConfig]) => combineLatest([
					this.organizationService.getById(organization.id),
					observableOf(datePickerConfig),
				])),
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
				tap(([organization]) => {
					if (organization.timeZone) {
						let format: string; 
						if (moment.tz.zonesForCountry('US').includes(organization.timeZone)) {
							format = 'MM.DD.YYYY';
						} else {
							format = 'DD.MM.YYYY';
						}
						this.locale = {
							...this.locale,
							displayFormat: format,
							format: format
						}
					}
					if (organization.startWeekOn) {
						this.locale = {
							...this.locale,
							firstDay: dayOfWeekAsString(organization.startWeekOn)
						}
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.dateRangePickerBuilderService.datePickerRange$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				untilDestroyed(this)
			)
			.subscribe()
	}

	ngAfterViewInit() {
		this.range$
			.pipe(
				distinctUntilChange(),
				debounceTime(100),
				tap((range: IDateRangePicker) => {
					this.store.selectedDateRange = range;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Create Date Range Translated Menus 
	 */
	createDateRangeMenus() {
		this.ranges = new Object();
		this.ranges[DateRangeKeyEnum.TODAY] = [moment(), moment()];
		this.ranges[DateRangeKeyEnum.YESTERDAY] = [moment().subtract(1, 'days'), moment().subtract(1, 'days')];
		this.ranges[DateRangeKeyEnum.CURRENT_WEEK] = [moment().startOf('week'), moment().endOf('week')];
		this.ranges[DateRangeKeyEnum.LAST_WEEK] = [moment().subtract(1, 'week').startOf('week'), moment().subtract(1, 'week').endOf('week')];
		this.ranges[DateRangeKeyEnum.CURRENT_MONTH] = [moment().startOf('month'), moment().endOf('month')];
		this.ranges[DateRangeKeyEnum.LAST_MONTH] = [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')];

		if (this.isLockDatePicker && (this.unitOfTime !== 'day')) {
			delete this.ranges[DateRangeKeyEnum.TODAY];
			delete this.ranges[DateRangeKeyEnum.YESTERDAY];
		}

		if (this.isLockDatePicker && (this.unitOfTime !== 'week')) {
			delete this.ranges[DateRangeKeyEnum.CURRENT_WEEK];
			delete this.ranges[DateRangeKeyEnum.LAST_WEEK];
		}

		if (this.isLockDatePicker && (this.unitOfTime !== 'month')) {
			delete this.ranges[DateRangeKeyEnum.CURRENT_MONTH];
			delete this.ranges[DateRangeKeyEnum.LAST_MONTH];
		}		
	}

	/**
	 * Allowed/Disallowed future max date strategy.
	 */
	setFutureStrategy() {
		if (this.hasFutureStrategy()) {
			this.maxDate = null;
		} else {
			this.maxDate = moment().format();
			if (
				this.isSameOrAfterDay(this.selectedDateRange.endDate)
			) {
				this.selectedDateRange = {
					...this.selectedDateRange,
					endDate: moment().toDate()
				}
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
	 * Is check to disabled Next Button or Not
	 * 
	 * @returns 
	 */
	isNextDisabled() {
		if (!this.selectedDateRange) {
			return true;
		}
		const { startDate, endDate } = this.selectedDateRange;
		if (startDate && endDate) {
			return this.hasFutureStrategy()
				? false
				: this.isSameOrAfterDay(endDate);
		} else {
			return true;
		}
	}

	/**
	 * listen event on ngx-daterangepicker-material
	 * @param event
	 */
	onDatesUpdated(event: any) {
		if (this.dateRangePickerDirective) {
			const { startDate, endDate } = event;
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
	 * listen range click event on ngx-daterangepicker-material
	 * @param event
	 */
	rangeClicked(range: any) {
		const { label } = range 
		switch (label) {
			case DateRangeKeyEnum.TODAY:
			case DateRangeKeyEnum.YESTERDAY:
				this.unitOfTime = 'day';
				break;
			case DateRangeKeyEnum.CURRENT_WEEK:
			case DateRangeKeyEnum.LAST_WEEK:
				this.unitOfTime = 'week';
				break;
			case DateRangeKeyEnum.CURRENT_MONTH:
			case DateRangeKeyEnum.LAST_MONTH:
				this.unitOfTime = 'month';
				break;
			default:
				break;
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
					const date = (!this.hasFutureStrategy() && this.isSameOrAfterDay(startDate)) ? 
							moment() :
							moment(startDate);

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
	 * If has future strategy or not
	 * 
	 * @param date
	 * @returns {Boolean}
	 */
	hasFutureStrategy(): boolean {
		const { isDisableFutureDatePicker, futureDateAllowed } = this;
		if (isDisableFutureDatePicker) {
			return !isDisableFutureDatePicker;
		} else {
			return futureDateAllowed;
		}
	}

	/**
	 * Open Date Picker On Calender Click
	 */
	openDatepicker() {
		this.dateRangePickerDirective.toggle();
	}

	ngOnDestroy() {}
}
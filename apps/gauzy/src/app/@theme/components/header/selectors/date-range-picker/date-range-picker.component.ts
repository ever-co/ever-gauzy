import { Component, OnInit, OnDestroy, AfterViewInit, Input, ViewChild } from '@angular/core';
import { combineLatest, of as observableOf, Subject, switchMap } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DaterangepickerDirective as DateRangePickerDirective, LocaleConfig } from 'ngx-daterangepicker-material';
import * as moment from 'moment';
import { IDateRangePicker } from '@gauzy/contracts';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import { TranslateService } from '@ngx-translate/core';
import { DateRangePickerBuilderService, OrganizationsService, Store } from './../../../../../@core/services';
import { Arrow } from './arrow/context/arrow.class';
import { Next, Previous } from './arrow/strategies';
import { TranslationBaseComponent } from './../../../../../@shared/language-base';

export enum DateRangeKeyEnum {
	TODAY = 'Today',
	YESTERDAY = 'Yesterday',
	CURRENT_WEEK = 'Current week',
	LAST_WEEK = 'Last week',
	LAST_30_DAYS = 'Last 30 days',
	CURRENT_MONTH = 'Current month',
	LAST_MONTH = 'Last month'
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-date-range-picker',
	templateUrl: './date-range-picker.component.html',
	styleUrls: ['./date-range-picker.component.scss']
})
export class DateRangePickerComponent extends TranslationBaseComponent 
	implements AfterViewInit, OnInit, OnDestroy {

	public maxDate: moment.Moment;
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
		direction: 'ltr'
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
	_unitOfTime: moment.unitOfTime.Base = 'month';
	get unitOfTime(): moment.unitOfTime.Base {
		return this._unitOfTime;
	}
	@Input() set unitOfTime(value: moment.unitOfTime.Base) {
		if (value) {
			this._unitOfTime = value;
		}
		this.selectedDateRange = {
			startDate: moment().startOf(this.unitOfTime).toDate(),
			endDate: moment().endOf(this.unitOfTime).toDate(),
			isCustomDate: false
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
			this._selectedDateRange = range;
			this.range$.next(range);
		}		
	}

	@ViewChild(DateRangePickerDirective, { static: false }) dateRangePickerDirective: DateRangePickerDirective;

	constructor(
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly organizationService: OrganizationsService,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(translateService);
	}

	ngOnInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeUnitOfTime$ = this.dateRangePickerBuilderService.pickerRangeUnitOfTime$;
		combineLatest([storeOrganization$, storeUnitOfTime$])
			.pipe(
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				switchMap(([organization, unitOfTime]) => combineLatest([
					this.organizationService.getById(organization.id),
					observableOf(unitOfTime)
				])),
				tap(([organization, unitOfTime]) => {
					this.futureDateAllowed = organization.futureDateAllowed;
					this.unitOfTime = (unitOfTime || 'month') as moment.unitOfTime.Base;
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
		this.ranges[DateRangeKeyEnum.LAST_30_DAYS] = [moment().subtract(29, 'days'), moment()];
		this.ranges[DateRangeKeyEnum.CURRENT_MONTH] = [moment().startOf('month'), moment().endOf('month')];
		this.ranges[DateRangeKeyEnum.LAST_MONTH] = [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')];
	}

	/**
	 * Allowed/Disallowed future max date strategy.
	 */
	setFutureStrategy() {
		const isSameOrAfter = moment(this.selectedDateRange.endDate).isSameOrAfter(moment());
		if (this.futureDateAllowed) {
			this.maxDate = null;
		} else if (!this.futureDateAllowed && isSameOrAfter) {
			this.maxDate = moment();
			this.selectedDateRange = {
				...this.selectedDateRange,
				endDate: moment().toDate()
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
		this.selectedDateRange = this.arrow.execute(this.selectedDateRange);
		this.setFutureStrategy();
	}

   /**
   * get previous selected range
   */
	previousRange() {
		this.arrow.setStrategy = this.previous;
		this.selectedDateRange = this.arrow.execute(this.selectedDateRange);
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
			return this.futureDateAllowed
				? false
				: moment(this.selectedDateRange.endDate).isSameOrAfter(moment(), 'day');
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
				this.selectedDateRange = {
					...this.selectedDateRange,
					startDate: startDate.toDate(),
					endDate: endDate.toDate(),
					isCustomDate: this.isCustomDate(event)
				}
			}
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
	 * listen range click event on ngx-daterangepicker-material
	 * @param event
	 */
	rangeClicked(event: any) {}
	
	ngOnDestroy() {}
}
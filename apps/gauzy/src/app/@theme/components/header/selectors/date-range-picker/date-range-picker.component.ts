import { Component, OnInit, OnDestroy, AfterViewInit, Input, ViewChild } from '@angular/core';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DaterangepickerDirective as DateRangePickerDirective, LocaleConfig } from 'ngx-daterangepicker-material';
import * as moment from 'moment';
import { IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import { TranslateService } from '@ngx-translate/core';
import { Store } from './../../../../../@core/services';
import { Arrow } from './../../../../../@shared/timesheet/gauzy-range-picker/arrow/context/arrow.class';
import { Next, Previous } from './../../../../../@shared/timesheet/gauzy-range-picker/arrow/strategies';
import { IDateRangeStrategy } from './../../../../../@shared/timesheet/gauzy-range-picker/arrow/strategies/arrow-strategy.interface';
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
	 * declaration of arrow variables
	 */
	private arrow: Arrow = new Arrow();
	private next: Next = new Next();
	private previous: Previous = new Previous();

	/**
	 * ngx-daterangepicker-material local configuration
	 */
	public localConfig: LocaleConfig = {
		displayFormat: 'MMM DD, YYYY', // could be 'YYYY-MM-DDTHH:mm:ss.SSSSZ'
		format: 'YYYY-MM-DD', // default is format value
		direction: 'ltr'
	}
	
	/**
	 * Define ngx-daterangepicker-material range configuration
	 */
	public ranges: any;

	/*
	* Getter & Setter for dynamic interval units
	*/
	_intervalUnit: moment.unitOfTime.Base = 'month';
	get intervalUnit(): moment.unitOfTime.Base {
		return this._intervalUnit;
	}
	@Input() set intervalUnit(value: moment.unitOfTime.Base) {
		this._intervalUnit = value;
	}

	/**
	 * show or hide arrows button, show by default
	 */
	@Input()
	arrows: boolean = true;

	/*
	* Getter & Setter for dynamic enabled/disabled element
	*/
	_selectedDateRange: IDateRangeStrategy = {
		startDate: moment().startOf(this.intervalUnit).toDate(),
		endDate: moment().endOf(this.intervalUnit).toDate()
	};
	get selectedDateRange(): IDateRangeStrategy {
		return this._selectedDateRange;
	}
	@Input() set selectedDateRange(range: IDateRangeStrategy) {
		this.store.selectedDateRange = range;
		this._selectedDateRange = range;
	}

	@ViewChild(DateRangePickerDirective, { static: false }) dateRangePickerDirective: DateRangePickerDirective;

	constructor(
		private readonly store: Store,
		public readonly translateService: TranslateService,
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				debounceTime(200),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap(() => this.createDateRangeMenus()),
				tap((organization: IOrganization) => {
					this.localConfig = {
						...this.localConfig,
						displayFormat: organization.dateFormat
					}
				}),
				tap((organization: IOrganization) => {
					this.futureDateAllowed = organization.futureDateAllowed;
					this.setFutureStrategy()
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {}

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
		return this.futureDateAllowed
			? false
			: moment(this.selectedDateRange.endDate).isSameOrAfter(moment(), 'day');
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
					endDate: endDate.toDate()
				}
			}
		}
	}
	
	ngOnDestroy() {}
}

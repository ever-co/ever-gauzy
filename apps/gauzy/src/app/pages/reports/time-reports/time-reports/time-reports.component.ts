import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { pick, pluck } from 'underscore';
import * as moment from 'moment';
import { DateRangePickerBuilderService } from '@gauzy/ui-sdk/core';
import {
	IGetTimeLogReportInput,
	ITimeLogFilters,
	ReportGroupByFilter,
	ReportGroupFilterEnum,
	TimeLogType
} from '@gauzy/contracts';
import { distinctUntilChange, isEmpty } from '@gauzy/ui-sdk/common';
import { Store } from './../../../../@core/services';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { BaseSelectorFilterComponent } from './../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { ChartUtil } from './../../../../@shared/report/charts/line-chart/chart-utils';
import { IChartData } from './../../../../@shared/report/charts/line-chart';
import { GauzyFiltersComponent } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';
import { TimesheetFilterService } from './../../../../@shared/timesheet';
import { TimeZoneService } from '../../../../@shared/timesheet/gauzy-filters/timezone-filter';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-time-reports',
	templateUrl: './time-reports.component.html',
	styleUrls: ['./time-reports.component.scss']
})
export class TimeReportsComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit, OnDestroy {
	public filters: ITimeLogFilters;
	public loading: boolean = false;
	public charts: IChartData;
	public groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;
	public datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;
	public payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly cdr: ChangeDetectorRef,
		public readonly translateService: TranslateService,
		private readonly timesheetFilterService: TimesheetFilterService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
	}

	ngOnInit() {
		this.cdr.detectChanges();
	}

	ngAfterViewInit() {
		this.subject$
			.pipe(
				// Filter to ensure that the organization property is truthy
				filter(() => !!this.organization),
				// Perform some action when the observable emits a value
				tap(() => this.prepareRequest()),
				// Unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				// Ensure distinct emissions to avoid redundant updates
				distinctUntilChange(),
				// Filter out falsy values for payloads
				filter((payloads: ITimeLogFilters) => !!payloads),
				// Execute the updateChart method when the observable emits a value
				tap(() => this.updateChart()),
				// Unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Gauzy timesheet default filters
	 *
	 * @param filters
	 */
	filtersChange(filters: ITimeLogFilters) {
		if (this.gauzyFiltersComponent.saveFilters) {
			this.timesheetFilterService.filter = filters;
		}
		this.filters = Object.assign({}, filters);
		this.subject$.next(true);
	}

	/**
	 * Get header selectors request
	 * Get gauzy timesheet filters request
	 *
	 * @returns
	 */
	prepareRequest() {
		// Check if request or filters are not provided, return early if true
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}
		// Pick specific properties ('source', 'activityLevel', 'logType') from this.filters
		const appliedFilter = pick(this.filters, 'source', 'activityLevel', 'logType');

		// Create a request object of type IGetTimeLogReportInput
		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request),
			// Set the 'groupBy' property from the current instance's 'groupBy' property
			groupBy: this.groupBy
		};

		// Emit the request object to the observable
		this.payloads$.next(request);
	}

	async updateChart() {
		// Check if organization or request is not available
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		// Set loading state to true
		this.loading = true;

		try {
			// Fetch time and activity data
			const payloads = this.payloads$.getValue();
			const logs: any = await this.timesheetService.getDailyReportChart(payloads);

			// Common options for chart datasets
			const commonOptions = {
				borderWidth: 2, // Width of the dataset border
				pointRadius: 2, // Radius of the data points
				pointHoverRadius: 4, // Radius of the data points on hover
				pointHoverBorderWidth: 4, // Width of the border of data points on hover
				tension: 0.4, // Tension of the spline curve connecting data points
				fill: false // Whether to fill the area under the line or not
			};

			// Prepare datasets for different time log types
			const datasets = [
				{
					label: TimeLogType.MANUAL,
					data: logs.map((log: any) => log.value[TimeLogType.MANUAL]),
					borderColor: ChartUtil.CHART_COLORS.red,
					backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.red, 1),
					...commonOptions
				},
				{
					label: TimeLogType.TRACKED,
					data: logs.map((log: any) => log.value[TimeLogType.TRACKED]),
					borderColor: ChartUtil.CHART_COLORS.blue,
					backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.blue, 1),
					...commonOptions
				},
				{
					label: TimeLogType.IDLE,
					data: logs.map((log: any) => log.value[TimeLogType.IDLE]),
					borderColor: ChartUtil.CHART_COLORS.yellow,
					backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.yellow, 1),
					...commonOptions
				},
				{
					label: TimeLogType.RESUMED,
					data: logs.map((log: any) => log.value[TimeLogType.RESUMED]),
					borderColor: ChartUtil.CHART_COLORS.green,
					backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.green, 1),
					...commonOptions
				}
			];

			// Update chart data
			this.charts = {
				labels: pluck(logs, 'date'),
				datasets
			};
		} catch (error) {
			// Handle errors
			console.log('Error while retrieving time & activity charts data', error);
		} finally {
			// Update chart data
			this.loading = false;
		}
	}

	ngOnDestroy(): void {}
}

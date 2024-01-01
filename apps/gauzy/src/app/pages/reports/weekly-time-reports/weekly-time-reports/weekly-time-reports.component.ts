import {
	AfterViewInit,
	ChangeDetectorRef,
	Component,
	OnInit,
	ViewChild
} from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { pluck, pick } from 'underscore';
import * as randomColor from 'randomcolor';
import {
	IGetTimeLogReportInput,
	ITimeLogFilters,
	ReportDayData
} from '@gauzy/contracts';
import { distinctUntilChange, isEmpty, progressStatus } from '@gauzy/common-angular';
import { moment } from './../../../../@core/moment-extend';
import { DateRangePickerBuilderService, Store } from './../../../../@core/services';
import { TimesheetService } from './../../../../@shared/timesheet/timesheet.service';
import { BaseSelectorFilterComponent } from './../../../../@shared/timesheet/gauzy-filters/base-selector-filter/base-selector-filter.component';
import { IChartData } from './../../../../@shared/report/charts/line-chart';
import { ChartUtil } from './../../../../@shared/report/charts/line-chart/chart-utils';
import { GauzyFiltersComponent } from './../../../../@shared/timesheet/gauzy-filters/gauzy-filters.component';
import { TimesheetFilterService } from './../../../../@shared/timesheet';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-weekly-time-reports',
	templateUrl: './weekly-time-reports.component.html',
	styleUrls: ['./weekly-time-reports.component.scss']
})
export class WeeklyTimeReportsComponent extends BaseSelectorFilterComponent
	implements OnInit, AfterViewInit {

	filters: ITimeLogFilters;
	weekLogs: ReportDayData[] = [];
	weekDays: string[] = [];
	loading: boolean = false;
	chartData: IChartData;

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;
	datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;
	payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	constructor(
		private readonly timesheetService: TimesheetService,
		private readonly cdr: ChangeDetectorRef,
		protected readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly timesheetFilterService: TimesheetFilterService,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(store, translateService, dateRangePickerBuilderService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				filter(() => !!this.organization),
				tap(() => this.prepareRequest()),
				untilDestroyed(this)
			)
			.subscribe();
		this.payloads$
			.pipe(
				distinctUntilChange(),
				filter((payloads: ITimeLogFilters) => !!payloads),
				tap(() => this.getWeeklyLogs()),
				tap(() => this.updateWeekDays()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.cdr.detectChanges();
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

		// Determine the current timezone using moment-timezone
		const timezone = moment.tz.guess();

		// Pick specific properties ('source', 'activityLevel', 'logType') from this.filters
		const appliedFilter = pick(this.filters, 'source', 'activityLevel', 'logType');

		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request),
			// Set the 'timezone' property to the determined timezone
			timezone
		};
		this.payloads$.next(request);
	}

	/**
	 * Updates Gauzy timesheet default filters and notifies subscribers about the change.
	 *
	 * @param filters - An object representing time log filters (ITimeLogFilters).
	 */
	filtersChange(filters: ITimeLogFilters): void {
		// Check if the filters should be saved
		if (this.gauzyFiltersComponent.saveFilters) {
			// Save filters to the timesheetFilterService if configured to do so
			this.timesheetFilterService.filter = filters;
		}

		// Create a shallow copy of the filters and update the class property
		this.filters = Object.assign({}, filters);

		// Notify subscribers about the filter change
		this.subject$.next(true);
	}


	/**
	 * Updates the week days based on the specified start and end dates.
	 * If no dates are provided in the request, it defaults to the current week.
	 */
	updateWeekDays() {
		const { startDate = moment().startOf('week'), endDate = moment().endOf('week') } = this.request;

		const start = moment(moment(startDate).format('YYYY-MM-DD'));
		const end = moment(moment(endDate).format('YYYY-MM-DD'));
		const range = Array.from(moment.range(start, end).by('day'));

		this.weekDays = range.map((date: moment.Moment) => date.format('YYYY-MM-DD'));
	}

	/**
	 * Asynchronously retrieves weekly time logs reports, processes the data, and updates the class properties.
	 *
	 * @returns
	 */
	async getWeeklyLogs(): Promise<void> {
		// Check if organization or request is not provided, resolve the Promise without further action
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		// Set the loading flag to true
		this.loading = true;

		try {
			// Get the current payloads from the observable
			const payloads = this.payloads$.getValue();

			// Fetch the weekly logs from the timesheetService
			const logs: ReportDayData[] = await this.timesheetService.getWeeklyReportChart(payloads);

			// Update the 'weekLogs' property with the retrieved logs
			this.weekLogs = logs;

			// Process and map the logs for chart presentation
			this._mapLogs(logs);
		} catch (error) {
			// Log any errors during the process
			console.error('Error while retrieving weekly time logs reports', error);
		} finally {
			// Set the loading flag to false, regardless of success or failure
			this.loading = false;
		}
	}

	/**
	 * Maps and formats log data for chart presentation.
	 *
	 * @param logs - An array of ReportDayData representing daily logs for employees.
	 * @private This method is intended for internal use within the class.
	 */
	private _mapLogs(logs: ReportDayData[]): void {
		// Initialize arrays for employees and datasets
		let employees = [];
		const datasets = [];

		// Iterate through each log in the provided array
		logs.forEach((log: ReportDayData) => {
			// Generate a random color for the dataset
			const color = randomColor({
				luminosity: 'light',
				format: 'rgba',
				alpha: 1
			});

			// Extract employee names from log dates
			employees = Object.keys(log.dates);

			// Build a dataset for the employee
			datasets.push({
				label: log.employee.fullName,
				data: pluck(log.dates, 'sum').map((val) => val ? parseFloat((val / 3600).toFixed(1)) : 0),
				borderColor: color,
				backgroundColor: ChartUtil.transparentize(color, 1),
				borderWidth: 1,
				pointRadius: 2,
				pointHoverRadius: 7,
				pointHoverBorderWidth: 6
			});
		});

		// Set the chartData property with formatted labels and datasets
		this.chartData = {
			labels: employees,
			datasets: datasets
		};
	}

	/**
	 * Retrieves the status based on a numerical value using the progressStatus function.
	 *
	 * @param value - A numerical value representing the progress or status.
	 * @returns The status determined by the progressStatus function.
	 */
	public getStatus(value: number) {
		return progressStatus(value);
	}
}

import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { pluck, pick } from 'underscore';
import * as randomColor from 'randomcolor';
import { IGetTimeLogReportInput, ITimeLogFilters, ReportDayData } from '@gauzy/contracts';
import {
	DateRangePickerBuilderService,
	moment,
	Store,
	TimesheetFilterService,
	TimesheetService
} from '@gauzy/ui-core/core';
import { distinctUntilChange, isEmpty, progressStatus } from '@gauzy/ui-core/common';
import {
	BaseSelectorFilterComponent,
	ChartUtil,
	DateFormatPipe,
	DurationFormatPipe,
	GauzyFiltersComponent,
	generateCsv,
	IChartData,
	TimeZoneService
} from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-weekly-time-reports',
	templateUrl: './weekly-time-reports.component.html',
	styleUrls: ['./weekly-time-reports.component.scss']
})
export class WeeklyTimeReportsComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit {
	public filters: ITimeLogFilters;
	public weekLogs: ReportDayData[] = [];
	public weekDays: string[] = [];
	public loading = false;
	public charts: IChartData;

	public datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;
	public payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;

	constructor(
		private readonly cdr: ChangeDetectorRef,
		private readonly timesheetService: TimesheetService,
		private readonly timesheetFilterService: TimesheetFilterService,
		public readonly translateService: TranslateService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService,
		private readonly dateFormatPipe: DateFormatPipe,
		private readonly durationFormatPipe: DurationFormatPipe
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(500),
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
				// Ensures that consecutive emissions are distinct
				distinctUntilChange(),
				// Filters out falsy payloads
				filter((payloads: ITimeLogFilters) => !!payloads),
				// Performs a side effect: invokes getWeeklyLogs()
				tap(() => this.getWeeklyLogs()),
				// Performs another side effect: invokes updateWeekDays()
				tap(() => this.updateWeekDays()),
				// Ensures that the subscription is automatically unsubscribed when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe(); // Subscribes to the observable
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

		// Pick specific properties ('source', 'activityLevel', 'logType') from this.filters
		const appliedFilter = pick(this.filters, 'source', 'activityLevel', 'logType');

		const request: IGetTimeLogReportInput = {
			...appliedFilter,
			...this.getFilterRequest(this.request)
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
	 * @returns {Promise<void>}
	 */
	async getWeeklyLogs(): Promise<void> {
		// Check if organization or request is not provided, resolve the Promise without further action
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		// Clear existing weekly logs
		this.weekLogs = [];

		// Set loading to true to indicate that the logs are being fetched
		this.loading = true;

		try {
			// Get the current payloads from the observable
			const payloads = this.payloads$.getValue();

			// Fetch the weekly logs from the timesheetService
			const newLogs = await this.timesheetService.getWeeklyReportChart(payloads);

			// Update weekLogs with the newly fetched logs
			this.weekLogs = newLogs;

			// Process and map the logs for chart presentation
			await this._mapLogs(this.weekLogs);
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
	private async _mapLogs(logs: ReportDayData[]): Promise<void> {
		// Initialize arrays for employees and datasets
		let labels = [];
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
			labels = Object.keys(log.dates);

			// Build a dataset for the employee
			datasets.push({
				label: log.employee.fullName, // Label for the dataset, presumably representing an employee's full name
				data: pluck(log.dates, 'sum').map((val) => (val ? parseFloat((val / 3600).toFixed(1)) : 0)), // An array of data points derived from the 'dates' property of 'log', converted from seconds to hours
				borderColor: color, // Color of the dataset border
				backgroundColor: ChartUtil.transparentize(color, 1), // Background color with transparency
				borderWidth: 2, // Width of the dataset border
				pointRadius: 2, // Radius of the data points
				pointHoverRadius: 4, // Radius of the data points on hover
				pointHoverBorderWidth: 4, // Width of the border of data points on hover
				tension: 0.4, // Tension of the spline curve connecting data points
				fill: false // Whether to fill the area under the line or not
			});
		});

		// Set the chartData property with formatted labels and datasets
		this.charts = {
			labels,
			datasets
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

	exportToCsv() {
		const data = [];

		if (!this.weekLogs || !Array.isArray(this.weekLogs)) {
			//TODO: replace with GZY-108: Error Handling on the Web Page
			console.error('weekLogs is undefined or not an array', this.weekLogs);
			return;
		}

		const dates = Object.keys(this.weekLogs[0].dates);

		this.weekLogs.forEach((entry) => {
			const employeeFullName = entry.employee?.fullName || 'N/A';

			const rowData = {
				employee: employeeFullName,
				...dates.reduce((acc, date) => {
					acc[date] = entry.dates[date]?.sum ? this.durationFormatPipe.transform(entry.dates[date].sum) : '-';
					return acc;
				}, {}),
				sum: this.durationFormatPipe.transform(entry?.sum || 0),
				durationPercentage: `${entry?.activity || 0}%`,
				spent: '-'
			};

			data.push(rowData);
		});

		if (!data.length) {
			console.error('No valid data to export');
			return;
		}

		const headers = [
			this.getTranslation('REPORT_PAGE.EMPLOYEE'),
			...dates.map((date) => this.dateFormatPipe.transform(date)),
			this.getTranslation('REPORT_PAGE.WEEKLY_TOTAL'),
			this.getTranslation('REPORT_PAGE.ACTIVITY'),
			this.getTranslation('REPORT_PAGE.SPENT')
		];

		const fileName = this.getTranslation('MENU.REPORTS');
		generateCsv(data, headers, fileName);
	}
}

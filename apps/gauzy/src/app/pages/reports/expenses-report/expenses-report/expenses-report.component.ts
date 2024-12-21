import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { IGetExpenseInput, ITimeLogFilters, ReportGroupByFilter, ReportGroupFilterEnum } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';
import { pluck } from 'underscore';
import { distinctUntilChange, isEmpty } from '@gauzy/ui-core/common';
import { DateRangePickerBuilderService, ExpensesService, Store, TimesheetFilterService } from '@gauzy/ui-core/core';
import {
	BaseSelectorFilterComponent,
	ChartUtil,
	GauzyFiltersComponent,
	IChartData,
	TimeZoneService
} from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-expenses-report',
    templateUrl: './expenses-report.component.html',
    styleUrls: ['./expenses-report.component.scss'],
    standalone: false
})
export class ExpensesReportComponent extends BaseSelectorFilterComponent implements OnInit, AfterViewInit {
	public filters: ITimeLogFilters;
	public loading: boolean = false;
	public charts: IChartData;
	public groupBy: ReportGroupByFilter = ReportGroupFilterEnum.date;

	public datePickerConfig$: Observable<any> = this.dateRangePickerBuilderService.datePickerConfig$;
	public payloads$: BehaviorSubject<ITimeLogFilters> = new BehaviorSubject(null);

	@ViewChild(GauzyFiltersComponent) gauzyFiltersComponent: GauzyFiltersComponent;

	constructor(
		public readonly translateService: TranslateService,
		private readonly _expensesService: ExpensesService,
		private readonly _cd: ChangeDetectorRef,
		private readonly _timesheetFilterService: TimesheetFilterService,
		protected readonly store: Store,
		protected readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		protected readonly timeZoneService: TimeZoneService
	) {
		super(store, translateService, dateRangePickerBuilderService, timeZoneService);
	}

	ngOnInit() {
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
				// Ensures that consecutive emissions are distinct
				distinctUntilChange(),
				// Filters out falsy payloads
				filter((payloads: ITimeLogFilters) => !!payloads),
				// Performs a side effect: invokes updateChart()
				tap(() => this.updateChart()),
				// Ensures that the subscription is automatically unsubscribed when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe(); // Subscribes to the observable
	}

	ngAfterViewInit() {
		this._cd.detectChanges();
	}

	/**
	 * Get header selectors request
	 * Get gauzy timesheet filters request
	 *
	 * @returns
	 */
	prepareRequest() {
		// Check if either request or filters are empty
		if (isEmpty(this.request) || isEmpty(this.filters)) {
			return;
		}

		// Prepare the request object
		const request: IGetExpenseInput = {
			...this.getFilterRequest(this.request), // Calls a method to get additional filter request parameters
			groupBy: this.groupBy, // Adds a "groupBy" property to the request
			...(this.filters?.categoryId ? { categoryId: this.filters?.categoryId } : {}) // add a "categoryId" to the request to filter with
		};

		// Emit the request object to the observable stream
		this.payloads$.next(request);
	}

	filterByCategory(event) {
		if (this.gauzyFiltersComponent.saveFilters) {
			// If true, set the timesheetFilterService's filter property to the provided filters
			this._timesheetFilterService.filter = this.filters;
		}
		this.filters = Object.assign(
			{},
			{
				...this.filters,
				categoryId: event?.id ? event?.id : ''
			}
		);
		this.subject$.next(true);
	}

	/**
	 * Gauzy timesheet default filters
	 *
	 * @param filters
	 */
	filtersChange(filters: ITimeLogFilters) {
		// Check if the saveFilters property of the gauzyFiltersComponent is truthy
		if (this.gauzyFiltersComponent.saveFilters) {
			// If true, set the timesheetFilterService's filter property to the provided filters
			this._timesheetFilterService.filter = filters;
		}

		// Create a shallow copy of the filters object and assign it to the component's filters property
		this.filters = Object.assign({}, filters);

		// Emit a new value (true) to the subject observable
		this.subject$.next(true);
	}

	/**
	 * Asynchronously fetch and update the expense report chart data.
	 *
	 * @returns {Promise<void>}
	 */
	async updateChart(): Promise<void> {
		// Check if the organization is not defined or if the request is empty
		if (!this.organization || isEmpty(this.request)) {
			return;
		}

		// Clear previous chart data and set the loading flag to true
		this.charts = null;
		this.loading = true;

		try {
			// Get the current value of the payloads$ observable
			const payloads = this.payloads$.getValue();

			// Fetch the expense report chart data from the expensesService
			const logs: any[] = await this._expensesService.getExpenseReportCharts(payloads);

			// Prepare datasets for the chart using the fetched data
			const datasets = [
				{
					label: this.getTranslation('REPORT_PAGE.EXPENSE'), // Label for the dataset, representing expenses
					data: logs.map((log) => log.value['expense']), // Extract expense values from logs
					borderColor: ChartUtil.CHART_COLORS.red, // Set the color of the dataset border
					backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.red, 1), // Transparent background color
					borderWidth: 2, // Set the dataset border width
					pointRadius: 2, // Set the data point radius
					pointHoverRadius: 4, // Data point radius on hover
					pointHoverBorderWidth: 4, // Border width of data points on hover
					tension: 0.4, // Set the curve tension between data points
					fill: false // Disable filling the area under the line
				}
			];

			// Update the chartData property with the new data
			this.charts = {
				labels: pluck(logs, 'date'), // Extract 'date' from each log for chart labels
				datasets // Set the datasets for the chart
			};
		} catch (error) {
			// Log any errors that occur during data retrieval
			console.error('Error while retrieving expense reports chart:', error);
		} finally {
			// Set the loading flag to false regardless of success or failure
			this.loading = false;
		}
	}
}

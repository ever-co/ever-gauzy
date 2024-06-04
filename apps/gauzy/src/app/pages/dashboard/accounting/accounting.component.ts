import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, debounceTime, firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { pluck } from 'underscore';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import {
	DateRangePickerBuilderService,
	EmployeeStatisticsService,
	EmployeesService,
	ToastrService
} from '@gauzy/ui-sdk/core';
import { IAggregatedEmployeeStatistic, IDateRangePicker, IOrganization, ISelectedEmployee } from '@gauzy/contracts';
import { distinctUntilChange, isEmpty, Store } from '@gauzy/ui-sdk/common';
import { ALL_EMPLOYEES_SELECTED } from '../../../@theme/components/header/selectors/employee';
import { IChartData } from '../../../@shared/report/charts/line-chart';
import { ChartUtil } from '../../../@shared/report/charts/line-chart/chart-utils';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-dashboard-accounting',
	templateUrl: './accounting.component.html',
	styleUrls: ['../../organizations/edit-organization/edit-organization.component.scss', './accounting.component.scss']
})
export class AccountingComponent extends TranslationBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	public aggregatedEmployeeStatistics: IAggregatedEmployeeStatistic;
	public selectedDateRange: IDateRangePicker;
	public organization: IOrganization;
	public charts: IChartData;
	public statistics$: Subject<boolean> = new Subject();
	public loading: boolean = false;

	constructor(
		private readonly employeesService: EmployeesService,
		private readonly store: Store,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly router: Router,
		private readonly employeeStatisticsService: EmployeeStatisticsService,
		private readonly toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._applyTranslationOnChart();
		this.store.selectedEmployee$
			.pipe(
				// Filter out falsy or invalid employees
				filter((employee: ISelectedEmployee) => !!employee && !!employee.id),
				// Perform a side effect: navigate to employee statistics
				tap(() => this.navigateToEmployeeStatistics()),
				// Ensure the subscription is automatically unsubscribed when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		this.statistics$
			.pipe(
				// Debounce the emissions to wait for a pause in changes
				debounceTime(200),
				// Perform a side effect: invoke the getAggregateStatistics method
				tap(() => this.getAggregateStatistics()),
				// Ensure the subscription is automatically unsubscribed when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeDateRange$ = this.dateRangePickerBuilderService.selectedDateRange$;

		combineLatest([storeOrganization$, storeDateRange$])
			.pipe(
				// Debounce the emissions to wait for a pause in changes
				debounceTime(200),
				// Ensure distinct combinations of emissions
				distinctUntilChange(),
				// Filter out invalid combinations
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				// Perform a side effect: set organization and dateRange properties
				tap(([organization, dateRange]) => {
					this.organization = organization as IOrganization;
					this.selectedDateRange = dateRange as IDateRangePicker;
				}),
				// Perform another side effect: notify subscribers about a change in statistics
				tap(() => this.statistics$.next(true)),
				// Ensure the subscription is automatically unsubscribed when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _applyTranslationOnChart() {
		// Subscribe to the onLangChange event from translateService
		this.translateService.onLangChange
			.pipe(
				// Perform a side effect: generate charts when the language changes
				tap(() => this.generateCharts()),
				// Ensure the subscription is automatically unsubscribed when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Navigates to the employee statistics page in the HR dashboard.
	 * Uses Angular Router to navigate to the specified route.
	 */
	navigateToEmployeeStatistics(): void {
		// Navigate to the '/pages/dashboard/hr' route
		this.router.navigate(['/pages/dashboard/hr']);
	}

	/**
	 * Retrieves aggregate statistics for employees within the specified organization and date range.
	 * Updates the component's state with the fetched data and triggers chart generation.
	 * Handles loading states and error notifications.
	 */
	async getAggregateStatistics(): Promise<void> {
		// Check if the organization is available
		if (!this.organization) {
			return;
		}

		try {
			// Extract relevant information
			const { id: organizationId, tenantId } = this.organization;
			const { startDate, endDate } = this.selectedDateRange;

			// Set loading state to true
			this.loading = true;

			// Fetch aggregate statistics from the service
			this.aggregatedEmployeeStatistics =
				await this.employeeStatisticsService.getAggregateStatisticsByOrganizationId({
					organizationId,
					tenantId,
					startDate,
					endDate
				});

			// Continue generating charts until there is data
			do {
				this.generateCharts();
			} while (!this.aggregatedEmployeeStatistics.chart.length);

			// Set loading state to false
			this.loading = false;
		} catch (error) {
			// Handle errors
			console.log('Error while retrieving employee aggregate statistics', error);
			this.toastrService.danger(error);
		}
	}

	/**
	 * Generates chart data based on aggregated employee statistics.
	 * Uses common options for chart datasets and updates the component's 'charts' property.
	 * Charts include income, expenses, profit, and bonus data.
	 */
	public generateCharts() {
		// Check if aggregatedEmployeeStatistics is empty
		if (isEmpty(this.aggregatedEmployeeStatistics)) {
			return;
		}

		// Common options for chart datasets
		const commonOptions = {
			borderWidth: 2, // Width of the dataset border
			pointRadius: 2, // Radius of the data points
			pointHoverRadius: 4, // Radius of the data points on hover
			pointHoverBorderWidth: 4, // Width of the border of data points on hover
			tension: 0.4, // Tension of the spline curve connecting data points
			fill: false // Whether to fill the area under the line or not
		};

		// Extract dates and statistics for each chart type
		const labels = pluck(this.aggregatedEmployeeStatistics.chart, 'dates');
		const income = pluck(pluck(this.aggregatedEmployeeStatistics.chart, 'statistics'), 'income');
		const expense = pluck(pluck(this.aggregatedEmployeeStatistics.chart, 'statistics'), 'expense');
		const profit = pluck(pluck(this.aggregatedEmployeeStatistics.chart, 'statistics'), 'profit');
		const bonus = pluck(pluck(this.aggregatedEmployeeStatistics.chart, 'statistics'), 'bonus');

		// Update the 'charts' property with dataset information
		this.charts = {
			labels,
			datasets: [
				{
					label: this.getTranslation('INCOME_PAGE.INCOME'),
					data: income,
					borderColor: ChartUtil.CHART_COLORS.blue,
					backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.blue, 1),
					...commonOptions
				},
				{
					label: this.getTranslation('DASHBOARD_PAGE.PROFIT_HISTORY.EXPENSES'),
					data: expense,
					borderColor: ChartUtil.CHART_COLORS.red,
					backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.red, 1),
					...commonOptions
				},
				{
					label: this.getTranslation('DASHBOARD_PAGE.CHARTS.PROFIT'),
					data: profit,
					borderColor: ChartUtil.CHART_COLORS.yellow,
					backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.yellow, 1),
					...commonOptions
				},
				{
					label: this.getTranslation('DASHBOARD_PAGE.CHARTS.BONUS'),
					data: bonus,
					borderColor: ChartUtil.CHART_COLORS.green,
					backgroundColor: ChartUtil.transparentize(ChartUtil.CHART_COLORS.green, 1),
					...commonOptions
				}
			]
		};
	}

	/**
	 * Selects an employee and fetches detailed information from the employeesService.
	 * Updates the selected employee in the store.
	 *
	 * @param employee - The selected employee information.
	 */
	async selectEmployee(employee: ISelectedEmployee) {
		// Fetch detailed information about the selected employee from the employeesService
		const people = await firstValueFrom(this.employeesService.getEmployeeById(employee.id, ['user']));

		// Set the selected employee in the store
		this.store.selectedEmployee = employee.id
			? ({
					id: people.id,
					firstName: people.user.firstName,
					lastName: people.user.lastName,
					imageUrl: people.user.imageUrl,
					employeeLevel: people.employeeLevel,
					shortDescription: people.short_description
			  } as ISelectedEmployee)
			: ALL_EMPLOYEES_SELECTED;
	}

	ngOnDestroy(): void {}
}

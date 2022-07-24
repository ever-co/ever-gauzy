import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, debounceTime, firstValueFrom } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import {
	IAggregatedEmployeeStatistic,
	IDateRangePicker,
	IOrganization,
	ISelectedEmployee,
	IUser
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import { ALL_EMPLOYEES_SELECTED } from '../../../@theme/components/header/selectors/employee';
import {
	EmployeesService,
	EmployeeStatisticsService,
	Store,
	ToastrService
} from '../../../@core/services';
import { IChartData } from '../../../@shared/report/charts/line-chart/line-chart.component';
import { pluck } from 'underscore';
import { ChartUtil } from '../../../@shared/report/charts/line-chart/chart-utils';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-accounting',
	templateUrl: './accounting.component.html',
	styleUrls: [
		'../../organizations/edit-organization/edit-organization.component.scss',
		'./accounting.component.scss'
	]
})
export class AccountingComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy
{
	aggregatedEmployeeStatistics: IAggregatedEmployeeStatistic;
	selectedDateRange: IDateRangePicker;
	organization: IOrganization;
	isEmployee: boolean;
	chartData: IChartData;
	statistics$: Subject<any> = new Subject();
	isLoading: boolean = false;

	constructor(
		private readonly employeesService: EmployeesService,
		private readonly store: Store,
		private readonly router: Router,
		private readonly employeeStatisticsService: EmployeeStatisticsService,
		private readonly toastrService: ToastrService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._applyTranslationOnSmartTable();
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap(
					(user: IUser) =>
						(this.isEmployee = user.employee ? true : false)
				),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedEmployee$
			.pipe(
				filter((employee) => !!employee && !!employee.id),
				tap(() => this.navigateToEmployeeStatistics()),
				untilDestroyed(this)
			)
			.subscribe();
		this.statistics$
			.pipe(
				debounceTime(300),
				tap(() => this.getAggregateStatistics()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const selectedDateRange$ = this.store.selectedDateRange$;
		combineLatest([storeOrganization$, selectedDateRange$])
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				filter(
					([organization, dateRange]) => !!organization && !!dateRange
				),
				tap(([organization, dateRange]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
				}),
				tap(() => this.statistics$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this.generateDataForChart()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	navigateToEmployeeStatistics() {
		this.router.navigate(['/pages/dashboard/hr']);
	}

	async getAggregateStatistics() {
		if (!this.organization || this.isEmployee) {
			return;
		}
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			const { startDate, endDate } = this.selectedDateRange;
			this.isLoading = true;
			this.aggregatedEmployeeStatistics =
				await this.employeeStatisticsService.getAggregateStatisticsByOrganizationId(
					{
						organizationId,
						tenantId,
						startDate,
						endDate
					}
				);
			this.generateDataForChart();
			this.isLoading = false;
		} catch (error) {
			console.log(
				'Error while retriving employee aggregate statistics',
				error
			);
			this.toastrService.danger(error);
		}
	}

	public generateDataForChart() {
		const commonOptions = {
			borderWidth: 2,
			pointRadius: 2,
			pointHoverRadius: 4,
			pointHoverBorderWidth: 4
		};
		this.chartData = {
			labels: pluck(this.aggregatedEmployeeStatistics.chart, 'dates'),
			datasets: [
				{
					label: this.getTranslation('INCOME_PAGE.INCOME'),
					data: pluck(
						pluck(
							this.aggregatedEmployeeStatistics.chart,
							'statistics'
						),
						'income'
					),
					borderColor: ChartUtil.CHART_COLORS.blue,
					backgroundColor: ChartUtil.transparentize(
						ChartUtil.CHART_COLORS.blue,
						1
					),
					...commonOptions
				},
				{
					label: this.getTranslation(
						'DASHBOARD_PAGE.PROFIT_HISTORY.EXPENSES'
					),
					data: pluck(
						pluck(
							this.aggregatedEmployeeStatistics.chart,
							'statistics'
						),
						'expense'
					),
					borderColor: ChartUtil.CHART_COLORS.red,
					backgroundColor: ChartUtil.transparentize(
						ChartUtil.CHART_COLORS.red,
						1
					),
					...commonOptions
				},
				{
					label: this.getTranslation('DASHBOARD_PAGE.CHARTS.PROFIT'),
					data: pluck(
						pluck(
							this.aggregatedEmployeeStatistics.chart,
							'statistics'
						),
						'profit'
					),
					borderColor: ChartUtil.CHART_COLORS.yellow,
					backgroundColor: ChartUtil.transparentize(
						ChartUtil.CHART_COLORS.yellow,
						1
					),
					...commonOptions
				},
				{
					label: this.getTranslation('DASHBOARD_PAGE.CHARTS.BONUS'),
					data: pluck(
						pluck(
							this.aggregatedEmployeeStatistics.chart,
							'statistics'
						),
						'bonus'
					),
					borderColor: ChartUtil.CHART_COLORS.green,
					backgroundColor: ChartUtil.transparentize(
						ChartUtil.CHART_COLORS.green,
						1
					),
					...commonOptions
				}
			]
		};
	}

	async selectEmployee(employee: ISelectedEmployee) {
		const people = await firstValueFrom(
			this.employeesService.getEmployeeById(employee.id, ['user'])
		);
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

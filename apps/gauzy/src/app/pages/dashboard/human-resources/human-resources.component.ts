import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
	BonusTypeEnum,
	EmployeeStatisticsHistoryEnum,
	IDateRangePicker,
	IMonthAggregatedEmployeeStatistics,
	IOrganization,
	ISelectedEmployee
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { combineLatest } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange, toUTC } from '@gauzy/ui-core/common';
import { DateRangePickerBuilderService, EmployeeStatisticsService, Store } from '@gauzy/ui-core/core';
import { ProfitHistoryComponent, RecordsHistoryComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-human-resources',
	templateUrl: './human-resources.component.html',
	styleUrls: ['./human-resources.component.scss']
})
export class HumanResourcesComponent implements OnInit, OnDestroy {
	loading: boolean;

	selectedDate: Date;
	selectedEmployee: ISelectedEmployee;
	selectedOrganization: IOrganization;
	selectedDateRange: IDateRangePicker;

	defaultCurrency: string;

	incomePermissionsError = false;
	expensePermissionError = false;

	employeeStatistics: IMonthAggregatedEmployeeStatistics[];
	expense = 0;
	expenseWithoutSalary: number;
	income: number;
	nonBonusIncome: number;
	profit: number;
	directIncomeBonus: number;
	bonus: number;
	calculatedBonus: number;
	bonusType: BonusTypeEnum;
	bonusPercentage: number;
	salary: number;
	averageBonus: number;
	statistics$: Subject<any> = new Subject();

	constructor(
		private readonly store: Store,
		private readonly dialogService: NbDialogService,
		private readonly router: Router,
		private readonly employeeStatisticsService: EmployeeStatisticsService,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {}

	async ngOnInit() {
		this.statistics$
			.pipe(
				debounceTime(300),
				tap(() => this.getEmployeeStatistics()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const selectedDateRange$ = this.dateRangePickerBuilderService.selectedDateRange$;
		const selectedEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, selectedDateRange$, selectedEmployee$])
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				filter(([organization, dateRange, employee]) => !!organization && !!dateRange && !!employee),
				tap(([organization, dateRange, employee]) => {
					this.selectedOrganization = organization;
					this.selectedDateRange = dateRange;
					this.selectedEmployee = employee;
				}),
				tap(() => {
					if (!this.selectedEmployee || !this.selectedEmployee.id) {
						this.navigateToAccounting();
						return;
					}
				}),
				tap(([organization]) => {
					this.bonusType = organization.bonusType as BonusTypeEnum;
					this.bonusPercentage = organization.bonusPercentage;
					this.defaultCurrency = organization.currency;
				}),
				tap(() => this.statistics$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async getEmployeeStatistics() {
		if (!this.selectedOrganization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.selectedOrganization;
		const { startDate, endDate } = this.selectedDateRange;

		this.loading = true;

		this.employeeStatistics = await this.employeeStatisticsService.getAggregatedStatisticsByEmployeeId({
			employeeId: this.selectedEmployee.id,
			startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss'),
			organizationId,
			tenantId
		});
		this.income = this._statsSum(this.employeeStatistics, 'income');
		this.expenseWithoutSalary = this._statsSum(this.employeeStatistics, 'expenseWithoutSalary');
		this.expense = this._statsSum(this.employeeStatistics, 'expense');
		this.directIncomeBonus = this._statsSum(this.employeeStatistics, 'directIncomeBonus');
		this.nonBonusIncome = this.income - this.directIncomeBonus;
		this.profit = this._statsSum(this.employeeStatistics, 'profit');
		this.bonus = this._statsSum(this.employeeStatistics, 'bonus');
		this.calculatedBonus = +(this.bonus - this.directIncomeBonus).toFixed(2);
		this.salary = +(this.expense - this.expenseWithoutSalary).toFixed(2);

		this.loading = false;
	}

	async openHistoryDialog(type: EmployeeStatisticsHistoryEnum) {
		if (!this.selectedOrganization) {
			return;
		}
		const { id: organizationId, tenantId } = this.selectedOrganization;
		const { startDate, endDate } = this.selectedDateRange;

		this.dialogService.open(RecordsHistoryComponent, {
			context: {
				type,
				records: await this.employeeStatisticsService.getEmployeeStatisticsHistory({
					employeeId: this.selectedEmployee.id,
					startDate,
					endDate,
					type,
					organizationId,
					tenantId
				})
			}
		});
	}

	/**
	 *
	 * @returns
	 */
	async openProfitDialog() {
		if (!this.selectedOrganization) {
			return;
		}

		const { id: organizationId, tenantId } = this.selectedOrganization;
		const { startDate, endDate } = this.selectedDateRange;

		const incomes = await this.employeeStatisticsService.getEmployeeStatisticsHistory({
			employeeId: this.selectedEmployee.id,
			startDate,
			endDate,
			type: EmployeeStatisticsHistoryEnum.INCOME,
			organizationId,
			tenantId
		});
		const expenses = await this.employeeStatisticsService.getEmployeeStatisticsHistory({
			employeeId: this.selectedEmployee.id,
			startDate,
			endDate,
			type: EmployeeStatisticsHistoryEnum.EXPENSES,
			organizationId,
			tenantId
		});

		this.dialogService.open(ProfitHistoryComponent, {
			context: {
				records: {
					incomes,
					expenses,
					incomeTotal: this.income,
					expenseTotal: this.expense,
					profit: this.profit
				}
			}
		});
	}

	/**
	 *
	 * @param employeeStatistics
	 * @param key
	 * @returns
	 */
	private _statsSum = (employeeStatistics: IMonthAggregatedEmployeeStatistics[], key: string): number => {
		return Number(employeeStatistics.reduce((a, b) => a + b[key], 0).toFixed(2));
	};

	/**
	 *
	 */
	navigateToAccounting() {
		this.router.navigate(['/pages/dashboard/accounting']);
	}

	/**
	 *
	 */
	edit() {
		this.router.navigate(['/pages/employees/edit/' + this.selectedEmployee.id]);
	}

	/**
	 * GET Employee Position Accessor
	 */
	get employeePosition() {
		if (!this.selectedEmployee) {
			return;
		}
		const { shortDescription, employeeLevel } = this.selectedEmployee;
		return [shortDescription, employeeLevel].filter(Boolean).join(' | ');
	}

	ngOnDestroy() {}
}

import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
	BonusTypeEnum,
	EmployeeStatisticsHistoryEnum,
	IMonthAggregatedEmployeeStatistics,
	IOrganization
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { EmployeeStatisticsService } from '../../../@core/services/employee-statistics.service';
import { Store } from '../../../@core/services/store.service';
import { ProfitHistoryComponent } from '../../../@shared/dashboard/profit-history/profit-history.component';
import { RecordsHistoryComponent } from '../../../@shared/dashboard/records-history/records-history.component';
import { SelectedEmployee } from '../../../@theme/components/header/selectors/employee/employee.component';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-human-resources',
	templateUrl: './human-resources.component.html',
	styleUrls: ['./human-resources.component.scss']
})
export class HumanResourcesComponent implements OnInit, OnDestroy {
	loading: boolean;

	selectedDate: Date;
	selectedEmployee: SelectedEmployee;
	selectedOrganization: IOrganization;

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
	avarageBonus: number;

	constructor(
		private store: Store,
		private dialogService: NbDialogService,
		private router: Router,
		private employeeStatisticsService: EmployeeStatisticsService
	) {}

	async ngOnInit() {
		this.loading = true;
		this.store.selectedEmployee$
			.pipe(
				filter((employee) => !!employee),
				debounceTime(200),
				untilDestroyed(this)
			)
			.subscribe((employee) => {
				this.selectedEmployee = employee;
				if (this.selectedDate) {
					this._loadEmployeeStatistics();
				}
			});
		this.store.selectedDate$
			.pipe(
				filter((date) => !!date),
				untilDestroyed(this)
			)
			.subscribe((date) => {
				this.selectedDate = date;
				if (this.selectedEmployee) {
					this._loadEmployeeStatistics();
				}
			});
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap(() => (this.defaultCurrency = null)),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				this.selectedOrganization = organization;
				if (this.selectedOrganization) {
					this.bonusType = this.selectedOrganization
						.bonusType as BonusTypeEnum;
					this.bonusPercentage = this.selectedOrganization.bonusPercentage;
					this.defaultCurrency = this.selectedOrganization.currency;
				}
			});
		this.store.selectedEmployee$
			.pipe(untilDestroyed(this))
			.subscribe((employee) => {
				if (!employee || !employee.id) {
					this.navigateToAccounting();
				}
			});
		this.loading = false;
	}

	async _loadEmployeeStatistics() {
		const { id: organizationId, tenantId } = this.selectedOrganization;
		this.employeeStatistics = await this.employeeStatisticsService.getAggregatedStatisticsByEmployeeId(
			{
				employeeId: this.selectedEmployee.id,
				valueDate: this.selectedDate || new Date(),
				months: this.selectedDate ? 1 : 12,
				organizationId,
				tenantId
			}
		);
		this.income = this._statsSum(this.employeeStatistics, 'income');
		this.expenseWithoutSalary = this._statsSum(
			this.employeeStatistics,
			'expenseWithoutSalary'
		);
		this.expense = this._statsSum(this.employeeStatistics, 'expense');
		this.directIncomeBonus = this._statsSum(
			this.employeeStatistics,
			'directIncomeBonus'
		);
		this.nonBonusIncome = this.income - this.directIncomeBonus;
		this.profit = this._statsSum(this.employeeStatistics, 'profit');
		this.bonus = this._statsSum(this.employeeStatistics, 'bonus');
		this.calculatedBonus = +(this.bonus - this.directIncomeBonus).toFixed(
			2
		);
		this.salary = +(this.expense - this.expenseWithoutSalary).toFixed(2);
	}

	async openHistoryDialog(type: EmployeeStatisticsHistoryEnum) {
		const { id: organizationId, tenantId } = this.selectedOrganization;
		this.dialogService.open(RecordsHistoryComponent, {
			context: {
				type,
				recordsData: await this.employeeStatisticsService.getEmployeeStatisticsHistory(
					{
						employeeId: this.selectedEmployee.id,
						valueDate: this.selectedDate || new Date(),
						months: this.selectedDate ? 1 : 12,
						type,
						organizationId,
						tenantId
					}
				)
			}
		});
	}

	async openProfitDialog() {
		const { id: organizationId, tenantId } = this.selectedOrganization;
		const incomes = await this.employeeStatisticsService.getEmployeeStatisticsHistory(
			{
				employeeId: this.selectedEmployee.id,
				valueDate: this.selectedDate || new Date(),
				months: this.selectedDate ? 1 : 12,
				type: EmployeeStatisticsHistoryEnum.INCOME,
				organizationId,
				tenantId
			}
		);
		const expenses = await this.employeeStatisticsService.getEmployeeStatisticsHistory(
			{
				employeeId: this.selectedEmployee.id,
				valueDate: this.selectedDate || new Date(),
				months: this.selectedDate ? 1 : 12,
				type: EmployeeStatisticsHistoryEnum.EXPENSES,
				organizationId,
				tenantId
			}
		);

		this.dialogService.open(ProfitHistoryComponent, {
			context: {
				recordsData: {
					incomes,
					expenses,
					incomeTotal: this.income,
					expenseTotal: this.expense,
					profit: this.profit
				}
			}
		});
	}

	private _statsSum = (
		employeeStatistics: IMonthAggregatedEmployeeStatistics[],
		key: string
	): number =>
		Number(employeeStatistics.reduce((a, b) => a + b[key], 0).toFixed(2));

	navigateToAccounting() {
		this.router.navigate(['/pages/dashboard/accounting']);
	}

	edit() {
		this.router.navigate([
			'/pages/employees/edit/' + this.selectedEmployee.id
		]);
	}

	ngOnDestroy() {}
}

import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
	BonusTypeEnum,
	EmployeeStatisticsHistoryEnum,
	MonthAggregatedEmployeeStatistics,
	Organization
} from '@gauzy/models';
import { NbDialogService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EmployeeStatisticsService } from '../../../@core/services/employee-statistics.service';
import { Store } from '../../../@core/services/store.service';
import { ProfitHistoryComponent } from '../../../@shared/dashboard/profit-history/profit-history.component';
import { RecordsHistoryComponent } from '../../../@shared/dashboard/records-history/records-history.component';
import { SelectedEmployee } from '../../../@theme/components/header/selectors/employee/employee.component';
@Component({
	selector: 'ga-human-resources',
	templateUrl: './human-resources.component.html',
	styleUrls: ['./human-resources.component.scss']
})
export class HumanResourcesComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	loading = true;

	selectedDate: Date;
	selectedEmployee: SelectedEmployee;
	selectedOrganization: Organization;

	incomeCurrency: string;
	expenseCurrency: string;
	defaultCurrency: string;

	incomePermissionsError = false;
	expensePermissionError = false;

	employeeStatistics: MonthAggregatedEmployeeStatistics[];
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

	constructor(
		private store: Store,
		private dialogService: NbDialogService,
		private router: Router,
		private employeeStatisticsService: EmployeeStatisticsService
	) {}

	async ngOnInit() {
		this.store.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((emp) => {
				this.expenseCurrency = null;
				this.incomeCurrency = null;
				this.defaultCurrency = null;
				if (emp) {
					this.selectedEmployee = emp;
				}

				if (this.selectedDate) {
					this._loadEmployeeStatistics();
				}
			});

		this.store.selectedDate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((date) => {
				this.selectedDate = date;

				if (this.selectedEmployee) {
					this._loadEmployeeStatistics();
				}
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
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
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employee) => {
				if (!employee || !employee.id) {
					this.navigateToAccounting();
				}
			});

		this.loading = false;
	}

	async _loadEmployeeStatistics() {
		this.employeeStatistics = await this.employeeStatisticsService.getAggregatedStatisticsByEmployeeId(
			{
				employeeId: this.selectedEmployee.id,
				valueDate: this.selectedDate || new Date(),
				months: this.selectedDate ? 1 : 12
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
		this.dialogService.open(RecordsHistoryComponent, {
			context: {
				type,
				recordsData: await this.employeeStatisticsService.getEmployeeStatisticsHistory(
					{
						employeeId: this.selectedEmployee.id,
						valueDate: this.selectedDate || new Date(),
						months: this.selectedDate ? 1 : 12,
						type
					}
				)
			}
		});
	}

	async openProfitDialog() {
		const incomes = await this.employeeStatisticsService.getEmployeeStatisticsHistory(
			{
				employeeId: this.selectedEmployee.id,
				valueDate: this.selectedDate || new Date(),
				months: this.selectedDate ? 1 : 12,
				type: EmployeeStatisticsHistoryEnum.INCOME
			}
		);
		const expenses = await this.employeeStatisticsService.getEmployeeStatisticsHistory(
			{
				employeeId: this.selectedEmployee.id,
				valueDate: this.selectedDate || new Date(),
				months: this.selectedDate ? 1 : 12,
				type: EmployeeStatisticsHistoryEnum.EXPENSES
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
		employeeStatistics: MonthAggregatedEmployeeStatistics[],
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

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

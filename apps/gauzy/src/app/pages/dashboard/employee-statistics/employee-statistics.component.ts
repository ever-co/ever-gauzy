import { Component, OnInit, OnDestroy } from '@angular/core';
import { IncomeService } from '../../../@core/services/income.service';
import { takeUntil } from 'rxjs/operators';
import { Store } from '../../../@core/services/store.service';
import { Subject } from 'rxjs';
import { ExpensesService } from '../../../@core/services/expenses.service';
import {
	Income,
	Expense,
	EmployeeRecurringExpense,
	OrganizationRecurringExpense,
	BonusTypeEnum,
	Organization,
	PermissionsEnum,
	DEFAULT_PROFIT_BASED_BONUS,
	DEFAULT_REVENUE_BASED_BONUS,
	OrganizationRecurringExpenseForEmployeeOutput,
	SplitExpenseOutput,
	RecurringExpenseDefaultCategoriesEnum
} from '@gauzy/models';
import { NbDialogService } from '@nebular/theme';
import {
	RecordsHistoryComponent,
	HistoryType
} from '../../../@shared/dashboard/records-history/records-history.component';
import { SelectedEmployee } from '../../../@theme/components/header/selectors/employee/employee.component';
import { EmployeeStatisticsService } from '../../../@core/services/employee-statistics.serivce';
import { EmployeeRecurringExpenseService } from '../../../@core/services/employee-recurring-expense.service';
import { OrganizationRecurringExpenseService } from '../../../@core/services/organization-recurring-expense.service';
import { ProfitHistoryComponent } from '../../../@shared/dashboard/profit-history/profit-history.component';

export interface ViewDashboardExpenseHistory {
	valueDate?: Date;
	vendorName?: string;
	categoryName: string;
	amount: number;
	notes?: string;
	recurring: boolean;
	source: 'employee' | 'org';
	originalValue?: number;
	employeeCount?: number;
}

@Component({
	selector: 'ga-employee-statistics',
	templateUrl: './employee-statistics.component.html',
	styleUrls: ['./employee-statistics.component.scss']
})
export class EmployeeStatisticsComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	loading = true;

	selectedDate: Date;
	selectedEmployee: SelectedEmployee;
	selectedOrganization: Organization;

	totalExpense = 0; //Employee Expenses + Org Recurring Expenses + Employee Recurring Expenses
	difference = 0; //the profit = totalAllIncome - totalExpense
	calculatedBonus = 0; //%age of income or profit depending on the settings
	bonusPercentage = 0; //%age which needs to be calculated
	totalBonus = 0; //calculatedBonus + totalBonusIncome
	bonusType: string; //either income or profit based
	totalSalary = 0; //filtered from employee recurring expenses with category name SALARY

	//Total Income = nonBonusIncome + totalBonusIncome
	totalNonBonusIncome = 0;
	totalBonusIncome = 0;
	totalAllIncome = 0;
	nonBonusIncomeData: Income[]; //Filtered from allIncomeData
	bonusIncomeData: Income[]; //Filtered from allIncomeData
	allIncomeData: Income[]; //Populated from GET call
	salaryData: ViewDashboardExpenseHistory[];

	avarageBonus: number;
	expensesData: Expense[];
	expenseData: ViewDashboardExpenseHistory[];
	employeeRecurringExpense: EmployeeRecurringExpense[];
	orgRecurringExpense: OrganizationRecurringExpense[];

	incomeCurrency: string;
	expenseCurrency: string;
	defaultCurrency: string;

	incomePermissionsError = false;
	expensePermissionError = false;

	constructor(
		private incomeService: IncomeService,
		private expenseService: ExpensesService,
		private store: Store,
		private dialogService: NbDialogService,
		private employeeStatisticsService: EmployeeStatisticsService,
		private employeeRecurringExpenseService: EmployeeRecurringExpenseService,
		private organizationRecurringExpenseService: OrganizationRecurringExpenseService
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
					this._loadEmployeeTotalIncome();
					this._loadEmployeeTotalExpense();
				}
			});

		this.store.selectedDate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((date) => {
				this.selectedDate = date;

				if (this.selectedEmployee) {
					this._loadEmployeeTotalIncome();
					this._loadEmployeeTotalExpense();
				}
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				this.selectedOrganization = organization;

				if (this.selectedOrganization) {
					this.bonusType = this.selectedOrganization.bonusType;
					this.bonusPercentage = this.selectedOrganization.bonusPercentage;
				}
			});

		this.employeeStatisticsService.avarageBonus$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(
				(calculatedBonus) => (this.avarageBonus = calculatedBonus)
			);

		this.loading = false;
	}

	openHistoryDialog(type: HistoryType) {
		this.dialogService.open(RecordsHistoryComponent, {
			context: {
				type,
				recordsData: this.getRecordsData(type)
			}
		});
	}

	getRecordsData(type: HistoryType) {
		switch (type) {
			case HistoryType.BONUS_INCOME:
				return this.bonusIncomeData;
			case HistoryType.NON_BONUS_INCOME:
				return this.nonBonusIncomeData;
			case HistoryType.INCOME:
				return this.allIncomeData;
			case HistoryType.EXPENSES:
				return this.expenseData;
			case HistoryType.SALARY:
				return this.salaryData;
			case HistoryType.EXPENSES_WITHOUT_SALARY:
				return this.expenseData.filter(
					(d) =>
						d.categoryName !==
						RecurringExpenseDefaultCategoriesEnum.SALARY
				);
			default:
				return [];
		}
	}

	openProfitDialog() {
		this.dialogService.open(ProfitHistoryComponent, {
			context: {
				recordsData: {
					income: this.allIncomeData as Income[],
					expenses: this.expenseData
				}
			}
		});
	}

	private async _loadEmployeeTotalIncome() {
		try {
			const { items } = this.store.hasPermission(
				PermissionsEnum.ORG_INCOMES_VIEW
			)
				? await this.incomeService.getAll(
						['employee', 'organization'],
						{
							employee: {
								id: this.selectedEmployee.id
							}
						},
						this.selectedDate
				  )
				: await this.incomeService.getMyAll(
						['employee', 'organization'],
						{},
						this.selectedDate
				  );

			this.allIncomeData = items || [];

			this.bonusIncomeData = this.allIncomeData.filter((d) => d.isBonus);
			this.nonBonusIncomeData =
				this.bonusIncomeData && this.bonusIncomeData.length > 0
					? this.allIncomeData.filter((d) => !d.isBonus)
					: this.allIncomeData;
		} catch (error) {
			this.allIncomeData = [];
			this.incomePermissionsError = true;
		}

		this.totalAllIncome = this.allIncomeData.reduce(
			(a, b) => a + +b.amount,
			0
		);

		this.totalBonusIncome = (this.bonusIncomeData || []).reduce(
			(a, b) => a + +b.amount,
			0
		);

		this.totalNonBonusIncome = this.totalAllIncome - this.totalBonusIncome;

		if (this.allIncomeData.length && this.totalAllIncome !== 0) {
			const firstItem = this.allIncomeData[0];

			this.incomeCurrency = firstItem.currency;
			this.defaultCurrency = firstItem.organization.currency;
		}
	}

	private async _loadEmployeeTotalExpense() {
		await this._loadExpense();
		const profit = this.totalAllIncome - Math.abs(this.totalExpense);
		this.difference = profit;
		this.calculatedBonus = this.calculateEmployeeBonus(
			this.bonusType,
			this.bonusPercentage,
			this.totalAllIncome,
			profit
		);
		this.totalBonus = this.calculatedBonus + this.totalBonusIncome;
	}

	private async _loadExpense() {
		try {
			const { items } = this.store.hasPermission(
				PermissionsEnum.ORG_EXPENSES_VIEW
			)
				? await this.expenseService.getAllWithSplitExpenses(
						this.selectedEmployee.id,
						['employee', 'organization'],
						this.selectedDate
				  )
				: await this.expenseService.getMyAllWithSplitExpenses(
						['employee', 'organization'],
						this.selectedDate
				  );

			const employeeRecurringExpense = this.selectedDate
				? (
						await this.employeeRecurringExpenseService.getAll([], {
							employeeId: this.selectedEmployee.id,
							year: this.selectedDate.getFullYear(),
							month: this.selectedDate.getMonth() + 1
						})
				  ).items
				: [];

			const orgRecurringExpense = this.selectedDate
				? (
						await this.organizationRecurringExpenseService.getSplitExpensesForEmployee(
							this.store.selectedOrganization.id,
							{
								year: this.selectedDate.getFullYear(),
								month: this.selectedDate.getMonth() + 1
							}
						)
				  ).items
				: [];

			const totalExpense = items.reduce((a, b) => a + +b.amount, 0);
			const totalEmployeeRecurringExpense = employeeRecurringExpense.reduce(
				(a, b) => a + +b.value,
				0
			);
			const totalOrgRecurringExpense = orgRecurringExpense.reduce(
				(a, b) => a + +b.value,
				0
			);

			this.expenseData = [
				...this.getViewDashboardExpenseHistory({ expense: items }),
				...this.getViewDashboardExpenseHistory({
					employeeRecurringExpense
				}),
				...this.getViewDashboardExpenseHistory({ orgRecurringExpense })
			];

			const onlySalary = employeeRecurringExpense.filter(
				(e) =>
					e.categoryName ===
					RecurringExpenseDefaultCategoriesEnum.SALARY
			);

			this.salaryData = this.getViewDashboardExpenseHistory({
				employeeRecurringExpense: onlySalary
			});

			this.totalSalary = onlySalary.reduce((a, b) => a + +b.value, 0);

			this.totalExpense =
				totalExpense +
				totalEmployeeRecurringExpense +
				totalOrgRecurringExpense;

			if (items.length && this.totalExpense !== 0) {
				const firstItem = items[0];

				this.expenseCurrency = firstItem.currency;
				this.defaultCurrency = firstItem.organization.currency;
			}
		} catch (error) {
			console.log(error);
			this.expensesData = [];
			this.expensePermissionError = true;
		}
	}

	private getViewDashboardExpenseHistory(data: {
		expense?: SplitExpenseOutput[];
		employeeRecurringExpense?: EmployeeRecurringExpense[];
		orgRecurringExpense?: OrganizationRecurringExpenseForEmployeeOutput[];
	}): ViewDashboardExpenseHistory[] {
		let viewDashboardExpenseHistory = [];

		if (data.expense && data.expense.length) {
			viewDashboardExpenseHistory = data.expense.map((e) => ({
				valueDate: e.valueDate,
				vendorName: e.vendorName,
				categoryName: e.categoryName,
				amount: e.amount,
				notes: e.notes,
				recurring: false,
				source: 'employee',
				splitExpense: e.splitExpense,
				originalValue: e.originalValue,
				employeeCount: e.employeeCount
			}));
		} else if (
			data.employeeRecurringExpense &&
			data.employeeRecurringExpense.length
		) {
			viewDashboardExpenseHistory = data.employeeRecurringExpense.map(
				(e) => ({
					valueDate: new Date(e.startYear, e.startMonth),
					categoryName: e.categoryName,
					amount: e.value,
					recurring: true,
					source: 'employee'
				})
			);
		} else if (
			data.orgRecurringExpense &&
			data.orgRecurringExpense.length
		) {
			viewDashboardExpenseHistory = data.orgRecurringExpense.map((e) => ({
				valueDate: new Date(e.startYear, e.startMonth),
				categoryName: e.categoryName,
				amount: e.value,
				recurring: true,
				source: 'org',
				splitExpense: e.splitExpense,
				originalValue: e.originalValue,
				employeeCount: e.employeeCount
			}));
		}
		return viewDashboardExpenseHistory;
	}

	calculateEmployeeBonus = (
		bonusType: string,
		bonusPercentage: number,
		income: number,
		profit: number
	) => {
		bonusType = bonusType ? bonusType : BonusTypeEnum.PROFIT_BASED_BONUS;
		switch (bonusType) {
			case BonusTypeEnum.PROFIT_BASED_BONUS:
				this.bonusPercentage =
					bonusPercentage || DEFAULT_PROFIT_BASED_BONUS;
				return (profit * this.bonusPercentage) / 100;
			case BonusTypeEnum.REVENUE_BASED_BONUS:
				this.bonusPercentage =
					bonusPercentage || DEFAULT_REVENUE_BASED_BONUS;
				return (income * this.bonusPercentage) / 100;
			default:
				return 0;
		}
	};

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

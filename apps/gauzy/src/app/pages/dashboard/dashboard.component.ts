import { Component, OnInit, OnDestroy } from '@angular/core';
import { IncomeService } from '../../@core/services/income.service';
import { first, takeUntil } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { Subject } from 'rxjs';
import { ExpensesService } from '../../@core/services/expenses.service';
import { AuthService } from '../../@core/services/auth.service';
import {
	RolesEnum,
	Income,
	Expense,
	EmployeeRecurringExpense,
	OrganizationRecurringExpense
} from '@gauzy/models';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import {
	RecordsHistoryComponent,
	HistoryType
} from '../../@shared/dashboard/records-history/records-history.component';
import { SelectedEmployee } from '../../@theme/components/header/selectors/employee/employee.component';
import { EmployeeStatisticsService } from '../../@core/services/employee-statistics.serivce';
import { EmployeeRecurringExpenseService } from '../../@core/services/employee-recurring-expense.service';
import { OrganizationRecurringExpenseService } from '../../@core/services/organization-recurring-expense.service';
import { ProfitHistoryComponent } from '../../@shared/dashboard/profit-history/profit-history.component';

export interface ViewDashboardExpenseHistory {
	valueDate?: Date;
	vendorName?: string;
	categoryName: string;
	amount: number;
	notes?: string;
	recurring: boolean;
	source: 'employee' | 'org';
}

@Component({
	templateUrl: './dashboard.component.html',
	styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	hasRole: boolean;
	loading = true;

	selectedDate: Date;
	selectedEmployee: SelectedEmployee;

	totalIncome = 0;
	totalExpense = 0;
	difference = 0;
	bonus = 0;

	avarageBonus: number;

	incomeData: Income[];
	expenseData: ViewDashboardExpenseHistory[];
	employeeRecurringexpense: EmployeeRecurringExpense[];
	orgRecurringexpense: OrganizationRecurringExpense[];

	incomeCurrency: string;
	expenseCurrency: string;
	defaultCurrency: string;

	constructor(
		private incomeService: IncomeService,
		private expenseService: ExpensesService,
		private authService: AuthService,
		private store: Store,
		private dialogService: NbDialogService,
		private employeeStatisticsService: EmployeeStatisticsService,
		private employeeRecurringExpenseService: EmployeeRecurringExpenseService,
		private organizationRecurringExpenseService: OrganizationRecurringExpenseService
	) {}

	async ngOnInit() {
		this.store.hideOrganizationShortcuts = true;

		this.hasRole = await this.authService
			.hasRole([RolesEnum.ADMIN, RolesEnum.DATA_ENTRY])
			.pipe(first())
			.toPromise();

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

		this.employeeStatisticsService.avarageBonus$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((bonus) => (this.avarageBonus = bonus));

		this.loading = false;
	}

	openHistoryDialog(type: HistoryType) {
		this.dialogService.open(RecordsHistoryComponent, {
			context: {
				type,
				recordsData:
					type === HistoryType.INCOME
						? this.incomeData
						: this.expenseData
			}
		});
	}

	openProfitDialog() {
		this.dialogService.open(ProfitHistoryComponent, {
			context: {
				recordsData: {
					income: this.incomeData as Income[],
					expenses: this.expenseData
				}
			}
		});
	}

	private async _loadEmployeeTotalIncome() {
		const { items } = await this.incomeService.getAll(
			['employee', 'organization'],
			{
				employee: {
					id: this.selectedEmployee.id
				}
			},
			this.selectedDate
		);

		this.incomeData = items;
		this.totalIncome = items.reduce((a, b) => a + +b.amount, 0);

		if (items.length && this.totalIncome !== 0) {
			const firstItem = items[0];

			this.incomeCurrency = firstItem.currency;
			this.defaultCurrency = firstItem.organization.currency;
		}
	}

	private async _loadEmployeeTotalExpense() {
		await this._loadExpense();
		this.difference = this.totalIncome - this.totalExpense;
		this.bonus = (this.difference * 75) / 100;
	}

	private async _loadExpense() {
		const { items } = await this.expenseService.getAll(
			['employee', 'organization'],
			{
				employee: { id: this.selectedEmployee.id }
			},
			this.selectedDate
		);

		const employeeRecurringexpense = (await this.employeeRecurringExpenseService.getAll(
			[],
			{
				employeeId: this.selectedEmployee.id,
				year: this.selectedDate.getFullYear(),
				month: this.selectedDate.getMonth() + 1
			}
		)).items;

		const orgRecurringexpense = (await this.organizationRecurringExpenseService.getForEmployee(
			{
				orgId: this.store.selectedOrganization.id,
				year: this.selectedDate.getFullYear(),
				month: this.selectedDate.getMonth() + 1
			}
		)).items;

		const totalExpense = items.reduce((a, b) => a + +b.amount, 0);
		const totalEmployeeRecurringexpense = employeeRecurringexpense.reduce(
			(a, b) => a + +b.value,
			0
		);
		const totalOrgRecurringexpense = orgRecurringexpense.reduce(
			(a, b) => a + +b.value,
			0
		);

		this.expenseData = [
			...this.getViewDashboardExpenseHistory({ expense: items }),
			...this.getViewDashboardExpenseHistory({
				employeeRecurringexpense
			}),
			...this.getViewDashboardExpenseHistory({ orgRecurringexpense })
		];

		this.totalExpense =
			totalExpense +
			totalEmployeeRecurringexpense +
			totalOrgRecurringexpense;

		if (items.length && this.totalExpense !== 0) {
			const firstItem = items[0];

			this.expenseCurrency = firstItem.currency;
			this.defaultCurrency = firstItem.organization.currency;
		}
	}

	private getViewDashboardExpenseHistory(data: {
		expense?: Expense[];
		employeeRecurringexpense?: EmployeeRecurringExpense[];
		orgRecurringexpense?: OrganizationRecurringExpense[];
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
				source: 'employee'
			}));
		} else if (
			data.employeeRecurringexpense &&
			data.employeeRecurringexpense.length
		) {
			viewDashboardExpenseHistory = data.employeeRecurringexpense.map(
				(e) => ({
					valueDate: new Date(e.year, e.month),
					categoryName: e.categoryName,
					amount: e.value,
					recurring: true,
					source: 'employee'
				})
			);
		} else if (
			data.orgRecurringexpense &&
			data.orgRecurringexpense.length
		) {
			viewDashboardExpenseHistory = data.orgRecurringexpense.map((e) => ({
				valueDate: new Date(e.year, e.month),
				categoryName: e.categoryName,
				amount: e.value,
				recurring: true,
				source: 'org'
			}));
		}

		return viewDashboardExpenseHistory;
	}

	ngOnDestroy() {
		this.store.hideOrganizationShortcuts = false;
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

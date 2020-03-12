import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { InvitationTypeEnum, PermissionsEnum } from '@gauzy/models';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'ng2-smart-table';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';
import { EmployeeStatisticsService } from '../../@core/services/employee-statistics.serivce';
import { EmployeesService } from '../../@core/services/employees.service';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';
import { Store } from '../../@core/services/store.service';
import { monthNames } from '../../@core/utils/date';
import { EmployeeEndWorkComponent } from '../../@shared/employee/employee-end-work-popup/employee-end-work.component';
import { EmployeeMutationComponent } from '../../@shared/employee/employee-mutation/employee-mutation.component';
import { InviteMutationComponent } from '../../@shared/invite/invite-mutation/invite-mutation.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { EmployeeAverageBonusComponent } from './table-components/employee-average-bonus/employee-average-bonus.component';
import { EmployeeAverageExpensesComponent } from './table-components/employee-average-expenses/employee-average-expenses.component';
import { EmployeeAverageIncomeComponent } from './table-components/employee-average-income/employee-average-income.component';
import { EmployeeBonusComponent } from './table-components/employee-bonus/employee-bonus.component';
import { EmployeeFullNameComponent } from './table-components/employee-fullname/employee-fullname.component';
import { EmployeeWorkStatusComponent } from './table-components/employee-work-status/employee-work-status.component';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';

interface EmployeeViewModel {
	fullName: string;
	email: string;
	bonus?: number;
	endWork?: any;
	id: string;
}

@Component({
	templateUrl: './employees.component.html',
	styleUrls: ['./employees.component.scss']
})
export class EmployeesComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	organizationName: string;
	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	selectedEmployee: EmployeeViewModel;
	selectedOrganizationId: string;

	private _ngDestroy$ = new Subject<void>();

	incomeStatistics: number[];
	expenseStatistics: number[];
	profitStatistics: number[];
	bonusStatistics: number[];
	averageBonus: number;
	averageExpense: number;
	averageIncome: number;
	statistics: any;
	employeeName = 'Employee';

	difference = 0;
	bonus = 0;
	totalIncome = 0;
	totalExpense = 0;
	bonusForSelectedMonth = 0;

	includeDeleted = false;
	loading = true;
	hasEditPermission = false;
	hasEditExpensePermission = false;
	hasInviteEditPermission = false;
	hasInviteViewOrEditPermission = false;
	organizationInvitesAllowed = false;

	@ViewChild('employeesTable', { static: false }) employeesTable;

	constructor(
		private employeesService: EmployeesService,
		private dialogService: NbDialogService,
		private store: Store,
		private router: Router,
		private toastrService: NbToastrService,
		private route: ActivatedRoute,
		private translate: TranslateService,
		private errorHandler: ErrorHandlingService,
		private employeeStatisticsService: EmployeeStatisticsService
	) {
		super(translate);
	}

	async ngOnInit() {
		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.ORG_EMPLOYEES_EDIT
				);
				this.hasInviteEditPermission = this.store.hasPermission(
					PermissionsEnum.ORG_INVITE_EDIT
				);
				this.hasInviteViewOrEditPermission =
					this.store.hasPermission(PermissionsEnum.ORG_INVITE_VIEW) ||
					this.hasInviteEditPermission;

				this.hasEditExpensePermission = this.store.hasPermission(
					PermissionsEnum.ORG_EXPENSES_EDIT
				);
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.selectedOrganizationId = organization.id;
					this.organizationInvitesAllowed =
						organization.invitesAllowed;
					this.loadPage();
				}
			});

		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();

		this.route.queryParamMap
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				if (params.get('openAddDialog')) {
					this.add();
				}
			});
	}

	async getEmployeeStatistics(id) {
		this.statistics = await this.employeeStatisticsService.getStatisticsByEmployeeId(
			id
		);

		const dateNow = new Date();

		this.incomeStatistics = this.statistics.incomeStatistics;
		this.expenseStatistics = this.statistics.expenseStatistics;
		this.profitStatistics = this.statistics.profitStatistics;
		this.bonusStatistics = this.statistics.bonusStatistics;

		this.bonusForSelectedMonth = this.bonusStatistics[
			Math.abs(11 - dateNow.getMonth() - 1)
		];

		if (
			this.expenseStatistics.filter(Number).reduce((a, b) => a + b, 0) !==
			0
		) {
			this.averageExpense =
				this.expenseStatistics
					.filter(Number)
					.reduce((a, b) => a + b, 0) /
				this.expenseStatistics.filter(Number).length;
		} else {
			this.averageExpense = 0;
		}

		if (
			this.incomeStatistics.filter(Number).reduce((a, b) => a + b, 0) !==
			0
		) {
			this.averageIncome =
				this.incomeStatistics
					.filter(Number)
					.reduce((a, b) => a + b, 0) /
				this.incomeStatistics.filter(Number).length;
		} else {
			this.averageIncome = 0;
		}

		if (
			this.bonusStatistics.filter(Number).reduce((a, b) => a + b, 0) !== 0
		) {
			this.averageBonus =
				this.bonusStatistics.filter(Number).reduce((a, b) => a + b, 0) /
				this.bonusStatistics.filter(Number).length;
		} else {
			this.averageBonus = 0;
		}
	}

	selectEmployeeTmp(ev: {
		data: EmployeeViewModel;
		isSelected: boolean;
		selected: EmployeeViewModel[];
		source: LocalDataSource;
	}) {
		if (ev.isSelected) {
			this.selectedEmployee = ev.data;
			const checkName = this.selectedEmployee.fullName.trim();
			this.employeeName = checkName ? checkName : 'Employee';
		} else {
			this.selectedEmployee = null;
		}
	}

	async add() {
		const dialog = this.dialogService.open(EmployeeMutationComponent);

		const data = await dialog.onClose.pipe(first()).toPromise();

		if (data) {
			if (data.user.firstName || data.user.lastName) {
				this.employeeName =
					data.user.firstName + ' ' + data.user.lastName;
			}
			this.toastrService.primary(
				this.employeeName.trim() +
					' added to ' +
					data.organization.name,
				'Success'
			);

			this.loadPage();
		}
	}

	edit() {
		this.router.navigate([
			'/pages/employees/edit/' + this.selectedEmployee.id
		]);
	}

	manageInvites() {
		this.router.navigate(['/pages/employees/invites']);
	}

	async invite() {
		const dialog = this.dialogService.open(InviteMutationComponent, {
			context: {
				invitationType: InvitationTypeEnum.EMPLOYEE,
				selectedOrganizationId: this.selectedOrganizationId,
				currentUserId: this.store.userId
			}
		});

		await dialog.onClose.pipe(first()).toPromise();
	}

	async delete() {
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType:
						this.selectedEmployee.fullName +
						' ' +
						this.getTranslation('FORM.DELETE_CONFIRMATION.EMPLOYEE')
				}
			})
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.employeesService.setEmployeeAsInactive(
							this.selectedEmployee.id
						);

						this.toastrService.primary(
							this.employeeName + ' set as inactive.',
							'Success'
						);

						this.loadPage();
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
	}

	async endWork() {
		const dialog = this.dialogService.open(EmployeeEndWorkComponent, {
			context: {
				endWorkValue: this.selectedEmployee.endWork,
				employeeFullName: this.selectedEmployee.fullName
			}
		});

		const data = await dialog.onClose.pipe(first()).toPromise();

		if (data) {
			try {
				await this.employeesService.setEmployeeEndWork(
					this.selectedEmployee.id,
					data
				);
				this.toastrService.primary(
					this.employeeName + ' set as inactive.',
					'Success'
				);
			} catch (error) {
				this.errorHandler.handleError(error);
			}
			this.selectedEmployee = null;
			this.loadPage();
		}
	}

	async backToWork() {
		const dialog = this.dialogService.open(EmployeeEndWorkComponent, {
			context: {
				backToWork: true,
				employeeFullName: this.selectedEmployee.fullName
			}
		});

		const data = await dialog.onClose.pipe(first()).toPromise();

		if (data) {
			try {
				await this.employeesService.setEmployeeEndWork(
					this.selectedEmployee.id,
					null
				);
				this.toastrService.primary(
					this.employeeName + ' set as active.',
					'Success'
				);
			} catch (error) {
				this.toastrService.danger(
					error.error.message || error.message,
					'Error'
				);
			}
			this.selectedEmployee = null;
			this.loadPage();
		}
	}

	private async loadPage() {
		this.selectedEmployee = null;

		const { items } = await this.employeesService
			.getAll(['user'], {
				organization: { id: this.selectedOrganizationId }
			})
			.pipe(first())
			.toPromise();
		const { name } = this.store.selectedOrganization;

		let employeesVm = [];
		const result = [];

		for (const emp of items) {
			await this.getEmployeeStatistics(emp.id);

			result.push({
				fullName: `${emp.user.firstName} ${emp.user.lastName}`,
				email: emp.user.email,
				id: emp.id,
				isActive: emp.isActive,
				endWork: emp.endWork ? new Date(emp.endWork) : '',
				workStatus: emp.endWork
					? new Date(emp.endWork).getDate() +
					  ' ' +
					  monthNames[new Date(emp.endWork).getMonth()] +
					  ' ' +
					  new Date(emp.endWork).getFullYear()
					: '',
				imageUrl: emp.user.imageUrl,
				// TODO: laod real bonus and bonusDate
				bonus: this.bonusForSelectedMonth,
				averageIncome: Math.floor(this.averageIncome),
				averageExpenses: Math.floor(this.averageExpense),
				averageBonus: Math.floor(this.averageBonus),
				bonusDate: Date.now()
			});
		}

		if (!this.includeDeleted) {
			result.forEach((employee) => {
				if (employee.isActive) {
					employeesVm.push(employee);
				}
			});
		} else {
			employeesVm = result;
		}

		this.sourceSmartTable.load(employeesVm);

		if (this.employeesTable) {
			this.employeesTable.grid.dataSet.willSelect = 'false';
		}

		this.organizationName = name;

		this.loading = false;
	}

	private _loadSmartTableSettings() {
		const dateNow = new Date();
		const month =
			monthNames[dateNow.getMonth() - 1] ||
			monthNames[monthNames.length - 1];
		const year = monthNames[dateNow.getMonth() - 1]
			? dateNow.getFullYear()
			: dateNow.getFullYear() - 1;

		this.settingsSmartTable = {
			actions: false,
			columns: {
				fullName: {
					title: this.getTranslation('SM_TABLE.FULL_NAME'),
					type: 'custom',
					renderComponent: EmployeeFullNameComponent,
					class: 'align-row'
				},
				email: {
					title: this.getTranslation('SM_TABLE.EMAIL'),
					type: 'email'
				},
				averageIncome: {
					title: this.getTranslation('SM_TABLE.INCOME'),
					type: 'custom',
					filter: false,
					class: 'text-center',
					renderComponent: EmployeeAverageIncomeComponent
				},
				averageExpenses: {
					title: this.getTranslation('SM_TABLE.EXPENSES'),
					type: 'custom',
					filter: false,
					class: 'text-center',
					renderComponent: EmployeeAverageExpensesComponent
				},
				averageBonus: {
					title: this.getTranslation('SM_TABLE.BONUS_AVG'),
					type: 'custom',
					filter: false,
					class: 'text-center',
					renderComponent: EmployeeAverageBonusComponent
				},
				bonus: {
					title: `${this.getTranslation(
						'SM_TABLE.BONUS'
					)} (${month} ${year})`,
					type: 'custom',
					filter: false,
					class: 'text-center',
					renderComponent: EmployeeBonusComponent
				},
				workStatus: {
					title: this.getTranslation('SM_TABLE.WORK_STATUS'),
					type: 'custom',
					class: 'text-center',
					width: '200px',
					renderComponent: EmployeeWorkStatusComponent,
					filter: false
				}
			},
			pager: {
				display: true,
				perPage: 8
			}
		};
	}

	changeIncludeDeleted(checked: boolean) {
		this.includeDeleted = checked;
		this.loadPage();
	}

	private _applyTranslationOnSmartTable() {
		this.translate.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this._loadSmartTableSettings();
			});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

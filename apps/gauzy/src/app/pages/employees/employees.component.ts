import { Component, OnInit, OnDestroy } from '@angular/core';
import { Store } from '../../@core/services/store.service';
import { first, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { LocalDataSource } from 'ng2-smart-table';
import { EmployeesService } from '../../@core/services/employees.service';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { EmployeeMutationComponent } from '../../@shared/employee/employee-mutation/employee-mutation.component';
import { EmployeeEndWorkComponent } from '../../@shared/employee/employee-end-work-popup/employee-end-work.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { EmployeeBonusComponent } from './table-components/employee-bonus/employee-bonus.component';
import { EmployeeFullNameComponent } from './table-components/employee-fullname/employee-fullname.component';
import { Router, ActivatedRoute } from '@angular/router';
import { monthNames } from '../../@core/utils/date';
import { EmployeeWorkStatusComponent } from './table-components/employee-work-status/employee-work-status.component';
import { TranslateService } from '@ngx-translate/core';
import { EmployeeAverageIncomeComponent } from './table-components/employee-average-income/employee-average-income.component';
import { EmployeeAverageExpensesComponent } from './table-components/employee-average-expenses/employee-average-expenses.component';
import { EmployeeAverageBonusComponent } from './table-components/employee-average-bonus/employee-average-bonus.component';
import { EmployeeStatisticsService } from '../../@core/services/employee-statistics.serivce';

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
export class EmployeesComponent implements OnInit, OnDestroy {
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
	statistics: any;

	constructor(
		private employeesService: EmployeesService,
		private dialogService: NbDialogService,
		private store: Store,
		private router: Router,
		private toastrService: NbToastrService,
		private route: ActivatedRoute,
		private translate: TranslateService,
		private employeeStatisticsService: EmployeeStatisticsService
	) {}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.selectedOrganizationId = organization.id;
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

		console.log('this.statistics');

		console.log(this.statistics);

		this.incomeStatistics = this.statistics.incomeStatistics;
		this.expenseStatistics = this.statistics.expenseStatistics;
		this.profitStatistics = this.statistics.profitStatistics;
		this.bonusStatistics = this.statistics.bonusStatistics;

		if (
			this.bonusStatistics.filter(Number).reduce((a, b) => a + b, 0) !== 0
		) {
			this.averageBonus =
				this.bonusStatistics.filter(Number).reduce((a, b) => a + b, 0) /
				this.bonusStatistics.filter(Number).length;
		} else {
			this.averageBonus = 0;
		}
		this.employeeStatisticsService.avarageBonus$.next(
			Math.floor(this.averageBonus)
		);
	}

	selectEmployeeTmp(ev: {
		data: EmployeeViewModel;
		isSelected: boolean;
		selected: EmployeeViewModel[];
		source: LocalDataSource;
	}) {
		if (ev.isSelected) {
			this.selectedEmployee = ev.data;
		} else {
			this.selectedEmployee = null;
		}
	}

	async add() {
		const dialog = this.dialogService.open(EmployeeMutationComponent);

		const data = await dialog.onClose.pipe(first()).toPromise();

		if (data) {
			this.loadPage();
		}
	}

	edit() {
		this.router.navigate([
			'/pages/employees/edit/' + this.selectedEmployee.id
		]);
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
						this.toastrService.info(
							'Employee set as inactive.',
							'Success'
						);
						this.loadPage();
					} catch (error) {
						this.toastrService.danger(
							error.error.message || error.message,
							'Error'
						);
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
				this.toastrService.info(
					this.selectedEmployee.fullName + ' set as inactive.',
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
				this.toastrService.info(
					this.selectedEmployee.fullName + ' set as active.',
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
		const { items } = await this.employeesService
			.getAll(['user'], {
				organization: { id: this.selectedOrganizationId }
			})
			.pipe(first())
			.toPromise();
		const { name } = this.store.selectedOrganization;

		let employeesVm = [];

		for (const emp of items) {
			if (emp.isActive) {
				await this.getEmployeeStatistics(emp.id);

				console.log(emp.id);
				// console.log(this.averageBonus)
				employeesVm.push({
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
					bonus: Math.floor(1000 * Math.random()) + 10,
					averageIncome: Math.floor(1000 * Math.random()) + 10,
					averageExpenses: Math.floor(1000 * Math.random()) + 10,
					averageBonus: this.averageBonus,
					bonusDate: Date.now()
				});
			}
		}
		// const employeesVm: EmployeeViewModel[] = items
		// .filter((i) => i.isActive)
		// .map((i) => {

		// 	console.log(i)
		// 	return {
		// 		fullName: `${i.user.firstName} ${i.user.lastName}`,
		// 		email: i.user.email,
		// 		id: i.id,
		// 		isActive: i.isActive,
		// 		endWork: i.endWork ? new Date(i.endWork) : '',
		// 		workStatus: i.endWork
		// 			? new Date(i.endWork).getDate() +
		// 			  ' ' +
		// 			  monthNames[new Date(i.endWork).getMonth()] +
		// 			  ' ' +
		// 			  new Date(i.endWork).getFullYear()
		// 			: '',
		// 		imageUrl: i.user.imageUrl,
		// 		// TODO: laod real bonus and bonusDate
		// 		bonus: Math.floor(1000 * Math.random()) + 10,
		// 		// averageIncome: Math.floor(1000 * Math.random()) + 10,
		// 		averageIncome: i.id,
		// 		averageExpenses: Math.floor(1000 * Math.random()) + 10,
		// 		averageBonus: Math.floor(1000 * Math.random()) + 10,
		// 		bonusDate: Date.now()
		// 	};
		// });

		this.sourceSmartTable.load(employeesVm);

		this.organizationName = name;
	}

	private _loadSmartTableSettings() {
		const dateNow = new Date();

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
					title: `${this.getTranslation('SM_TABLE.BONUS')} (${
						monthNames[dateNow.getMonth() - 1]
					} ${dateNow.getFullYear()})`,
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

	getTranslation(prefix: string) {
		let result = '';
		this.translate.get(prefix).subscribe((res) => {
			result = res;
		});
		return result;
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

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

	constructor(
		private employeesService: EmployeesService,
		private dialogService: NbDialogService,
		private store: Store,
		private router: Router,
		private toastrService: NbToastrService,
		private route: ActivatedRoute,
		private translateService: TranslateService
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

		this.route.queryParamMap
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				if (params.get('openAddDialog')) {
					this.add();
				}
			});
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
					recordType: this.selectedEmployee.fullName + ' employee'
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

		const employeesVm: EmployeeViewModel[] = items
			.filter((i) => i.isActive)
			.map((i) => {
				return {
					fullName: `${i.user.firstName} ${i.user.lastName}`,
					email: i.user.email,
					id: i.id,
					isActive: i.isActive,
					endWork: i.endWork ? new Date(i.endWork) : '',
					workStatus: i.endWork
						? new Date(i.endWork).getDate() +
						  ' ' +
						  monthNames[new Date(i.endWork).getMonth()] +
						  ' ' +
						  new Date(i.endWork).getFullYear()
						: '',
					imageUrl: i.user.imageUrl,
					// TODO: laod real bonus and bonusDate
					bonus: Math.floor(1000 * Math.random()) + 10,
					averageIncome: Math.floor(1000 * Math.random()) + 10,
					averageExpenses: Math.floor(1000 * Math.random()) + 10,
					averageBonus: Math.floor(1000 * Math.random()) + 10,
					bonusDate: Date.now()
				};
			});

		this.sourceSmartTable.load(employeesVm);

		this.organizationName = name;
	}

	private _loadSmartTableSettings() {
		const dateNow = new Date();

		this.settingsSmartTable = {
			actions: false,
			columns: {
				fullName: {
					title: 'Full Name',
					type: 'custom',
					renderComponent: EmployeeFullNameComponent,
					class: 'align-row'
				},
				email: {
					title: 'Email',
					type: 'email'
				},
				averageIncome: {
					title: ' Average Income',
					type: 'custom',
					filter: false,
					class: 'text-center',
					renderComponent: EmployeeAverageIncomeComponent
				},
				averageExpenses: {
					title: ' Average Expenses',
					type: 'custom',
					filter: false,
					class: 'text-center',
					renderComponent: EmployeeAverageExpensesComponent
				},
				averageBonus: {
					title: 'Average Bonus',
					type: 'custom',
					filter: false,
					class: 'text-center',
					renderComponent: EmployeeAverageBonusComponent
				},
				bonus: {
					title: `Bonus for ${
						monthNames[dateNow.getMonth() - 1]
					} ${dateNow.getFullYear()}`,
					type: 'custom',
					filter: false,
					class: 'text-center',
					renderComponent: EmployeeBonusComponent
				},
				workStatus: {
					title: 'Work Status',
					type: 'custom',
					class: 'text-center',
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

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

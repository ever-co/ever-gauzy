import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	ActivatedRoute,
	Router,
	RouterEvent,
	NavigationEnd
} from '@angular/router';
import {
	InvitationTypeEnum,
	ComponentLayoutStyleEnum,
	IOrganization,
	EmployeeViewModel,
	CrudActionEnum
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { debounceTime, filter, first, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { monthNames } from '../../@core/utils/date';
import { EmployeeEndWorkComponent } from '../../@shared/employee/employee-end-work-popup/employee-end-work.component';
import { EmployeeMutationComponent } from '../../@shared/employee/employee-mutation/employee-mutation.component';
import { InviteMutationComponent } from '../../@shared/invite/invite-mutation/invite-mutation.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { TranslationBaseComponent } from '../../@shared/language-base';
import { PictureNameTagsComponent } from '../../@shared/table-components';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	EmployeesService,
	EmployeeStore,
	ErrorHandlingService,
	Store,
	ToastrService
} from '../../@core/services';
import {
	EmployeeAverageIncomeComponent,
	EmployeeAverageExpensesComponent,
	EmployeeAverageBonusComponent,
	EmployeeWorkStatusComponent
} from './table-components';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './employees.component.html',
	styleUrls: ['./employees.component.scss']
})
export class EmployeesComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	selectedEmployee: EmployeeViewModel;
	employeeData: EmployeeViewModel[];
	organization: IOrganization;
	viewComponentName: ComponentEnum;
	disableButton = true;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
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
	loading: boolean;
	organizationInvitesAllowed = false;
	month;
	year;

	employeesTable: Ng2SmartTableComponent;
	@ViewChild('employeesTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.employeesTable = content;
			this.onChangedSource();
		}
	}

	subject$: Subject<any> = new Subject();

	constructor(
		private readonly employeesService: EmployeesService,
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		private readonly router: Router,
		private readonly toastrService: ToastrService,
		private readonly route: ActivatedRoute,
		public readonly translate: TranslateService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly _employeeStore: EmployeeStore
	) {
		super(translate);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();

		this.subject$
			.pipe(
				tap(() => this.loading = true),
				debounceTime(300),
				tap(() => this.getEmployees()),
				tap(() => this.clearItem()),
				tap(() => this.loading = false),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				debounceTime(100),
				filter((organization: IOrganization) => !!organization),
				tap((organization) => this.organization = organization),
				tap(({ invitesAllowed }) => this.organizationInvitesAllowed = invitesAllowed),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.add()),
				untilDestroyed(this)
			)
			.subscribe();
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	setView() {
		this.viewComponentName = ComponentEnum.EMPLOYEES;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.employeesTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	selectEmployee({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedEmployee = isSelected ? data : null;
		if (this.selectedEmployee) {
			this.employeeName = this.selectedEmployee.fullName.trim() || 'Employee';
		}
	}

	async add() {
		try {
			const dialog = this.dialogService.open(EmployeeMutationComponent);
			const response = await dialog.onClose.pipe(first()).toPromise();
			if (response) {
				response.map((data: any) => {
					if (data.user.firstName || data.user.lastName) {
						this.employeeName = data.user.firstName + ' ' + data.user.lastName;
					}
					this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_ADDED', {
						name: this.employeeName.trim(),
						organization: data.organization.name
					});
				});	
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.subject$.next(true);
		}
	}

	edit(selectedItem?: EmployeeViewModel) {
		if (selectedItem) {
			this.selectEmployee({
				isSelected: true,
				data: selectedItem
			});
		}
		this.router.navigate([ '/pages/employees/edit/', this.selectedEmployee.id ]);
	}

	manageInvites() {
		this.router.navigate(['/pages/employees/invites']);
	}

	async invite() {
		const dialog = this.dialogService.open(InviteMutationComponent, {
			context: {
				invitationType: InvitationTypeEnum.EMPLOYEE
			}
		});
		await dialog.onClose.pipe(first()).toPromise();
	}

	async delete(selectedItem?: EmployeeViewModel) {
		if (selectedItem) {
			this.selectEmployee({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType:
						this.selectedEmployee.fullName +
						' ' +
						this.getTranslation('FORM.DELETE_CONFIRMATION.EMPLOYEE')
				}
			})
			.onClose
			.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.employeesService.setEmployeeAsInactive(
							this.selectedEmployee.id
						);
						this._employeeStore.employeeAction = {
							action: CrudActionEnum.DELETED,
							employee: this.selectedEmployee as any
						};
						this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_INACTIVE', { 
							name: this.employeeName.trim() 
						});
					} catch (error) {
						this.errorHandler.handleError(error);
					} finally {
						this.subject$.next(true);
					}
				}
			});
	}

	async endWork(selectedItem?: EmployeeViewModel) {
		if (selectedItem) {
			this.selectEmployee({
				isSelected: true,
				data: selectedItem
			});
		}
		try {
			const dialog = this.dialogService.open(EmployeeEndWorkComponent, {
				context: {
					endWorkValue: this.selectedEmployee.endWork,
					employeeFullName: this.selectedEmployee.fullName
				}
			});
			const data = await dialog.onClose.pipe(first()).toPromise();
			if (data) {
				await this.employeesService.setEmployeeEndWork(
					this.selectedEmployee.id,
					data
				);
				this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_INACTIVE', {
					name: this.employeeName.trim()
				});
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.subject$.next(true);
		}
	}

	async backToWork(selectedItem?: EmployeeViewModel) {
		if (selectedItem) {
			this.selectEmployee({
				isSelected: true,
				data: selectedItem
			});
		}
		try {
			const dialog = this.dialogService.open(EmployeeEndWorkComponent, {
				context: {
					backToWork: true,
					employeeFullName: this.selectedEmployee.fullName
				}
			});
			const data = await dialog.onClose.pipe(first()).toPromise();
			if (data) {
				await this.employeesService.setEmployeeEndWork(
					this.selectedEmployee.id,
					null
				);
				this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_ACTIVE', {
					name: this.employeeName.trim()
				});
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.subject$.next(true);
		}
	}

	private async getEmployees() {
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const { items } = await this.employeesService
			.getAll(['user', 'tags'], { organizationId, tenantId })
			.pipe(first())
			.toPromise();

		let employeesVm = [];
		const result = [];
		for (const employee of items) {
			const { id, user, isActive, endWork, tags, averageIncome, averageExpenses, averageBonus, startedWorkOn } = employee;
			result.push({
				fullName: `${user.name}`,
				email: user.email,
				id,
				isActive,
				endWork: endWork ? new Date(endWork) : '',
				workStatus: endWork ? new Date(endWork).getDate() + ' ' + monthNames[new Date(endWork).getMonth()] + ' ' + new Date(endWork).getFullYear() : '',
				imageUrl: user.imageUrl,
				tags,
				// TODO: load real bonus and bonusDate
				bonus: this.bonusForSelectedMonth,
				averageIncome: Math.floor(averageIncome),
				averageExpenses: Math.floor(averageExpenses),
				averageBonus: Math.floor(averageBonus),
				bonusDate: Date.now(),
				startedWorkOn
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
		this.employeeData = employeesVm;
		this.sourceSmartTable.load(employeesVm);
		this.loading = false;
	}

	private _loadSmartTableSettings() {
		const dateNow = new Date();
		this.month =
			monthNames[dateNow.getMonth() - 1] ||
			monthNames[monthNames.length - 1];
		this.year = monthNames[dateNow.getMonth() - 1]
			? dateNow.getFullYear()
			: dateNow.getFullYear() - 1;

		this.settingsSmartTable = {
			actions: false,
			columns: {
				fullName: {
					title: this.getTranslation('SM_TABLE.FULL_NAME'),
					type: 'custom',
					renderComponent: PictureNameTagsComponent,
					class: 'align-row'
				},
				email: {
					title: this.getTranslation('SM_TABLE.EMAIL'),
					type: 'email',
					class: 'email-column'
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
		this.subject$.next(true);
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectEmployee({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.employeesTable && this.employeesTable.grid) {
			this.employeesTable.grid.dataSet['willSelect'] = 'false';
			this.employeesTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() {}
}

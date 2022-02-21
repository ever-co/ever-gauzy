import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
	InvitationTypeEnum,
	ComponentLayoutStyleEnum,
	IOrganization,
	EmployeeViewModel,
	CrudActionEnum,
	IEmployee
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Subject, firstValueFrom } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { monthNames } from '../../@core/utils/date';
import { EmployeeEndWorkComponent, EmployeeMutationComponent } from '../../@shared/employee';
import { InviteMutationComponent } from '../../@shared/invite/invite-mutation/invite-mutation.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { TranslationBaseComponent } from '../../@shared/language-base';
import { PictureNameTagsComponent } from '../../@shared/table-components';
import { ComponentEnum } from '../../@core/constants';
import {
	EmployeesService,
	EmployeeStore,
	ErrorHandlingService,
	Store,
	ToastrService
} from '../../@core/services';
import {
	EmployeeAverageBonusComponent,
	EmployeeAverageExpensesComponent,
	EmployeeAverageIncomeComponent,
	EmployeeTimeTrackingStatusComponent,
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
	employees: EmployeeViewModel[];
	viewComponentName: ComponentEnum;
	disableButton = true;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	bonusForSelectedMonth = 0;
	includeDeleted = false;
	loading: boolean;
	organizationInvitesAllowed = false;
	month: string;
	year: number;

	employeesTable: Ng2SmartTableComponent;
	@ViewChild('employeesTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.employeesTable = content;
			this.onChangedSource();
		}
	}

	public organization: IOrganization;
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
				distinctUntilChange(),
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
	}

	async add() {
		try {
			const dialog = this.dialogService.open(EmployeeMutationComponent);
			const response = await firstValueFrom(dialog.onClose);
			if (response) {
				response.map((employee: IEmployee) => {
					const { firstName, lastName } = employee.user;
					let fullName = 'Employee';
					if (firstName || lastName) {
						fullName = `${firstName} ${lastName}`;
					}
					this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_ADDED', {
						name: fullName,
						organization: employee.organization.name
					});
				});
				this.subject$.next(true);
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	edit(selectedItem?: EmployeeViewModel) {
		if (selectedItem) {
			this.selectEmployee({
				isSelected: true,
				data: selectedItem
			});
		}
		this.router.navigate(['/pages/employees/edit/', this.selectedEmployee.id]);
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
		await firstValueFrom(dialog.onClose);
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
						await this.employeesService.setEmployeeProfileStatus(this.selectedEmployee.id, {
							isActive: false
						});
						this._employeeStore.employeeAction = {
							action: CrudActionEnum.DELETED,
							employees: [this.selectedEmployee as any]
						};
						this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_INACTIVE', {
							name: this.selectedEmployee.fullName.trim()
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
			const data = await firstValueFrom(dialog.onClose);
			if (data) {
				await this.employeesService.setEmployeeEndWork(
					this.selectedEmployee.id,
					data
				);
				this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_INACTIVE', {
					name: this.selectedEmployee.fullName.trim()
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
			const data = await firstValueFrom(dialog.onClose);
			if (data) {
				await this.employeesService.setEmployeeEndWork(
					this.selectedEmployee.id,
					null
				);
				this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_ACTIVE', {
					name: this.selectedEmployee.fullName.trim()
				});
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.subject$.next(true);
		}
	}

	/**
	 * Restore deleted employee
	 * 
	 * @param selectedItem 
	 */
	async restoreToWork(selectedItem?: EmployeeViewModel) {
		if (selectedItem) {
			this.selectEmployee({
				isSelected: true,
				data: selectedItem
			});
		}
		try {
			await this.employeesService.setEmployeeProfileStatus(this.selectedEmployee.id, {
				isActive: true
			});
			this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_ACTIVE', {
				name: this.selectedEmployee.fullName.trim()
			});
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

		const { items } = await firstValueFrom(this.employeesService
			.getAll(['user', 'tags'], { organizationId, tenantId })
		);

		let employeesVm = [];
		const result = [];
		for (const employee of items) {
			const { id, user, isActive, endWork, tags, averageIncome, averageExpenses, averageBonus, startedWorkOn, isTrackingEnabled } = employee;
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
				startedWorkOn,
				isTrackingEnabled
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
		this.employees = employeesVm;
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
					class: 'align-row',
					width: '20%',
					renderComponent: PictureNameTagsComponent
				},
				email: {
					title: this.getTranslation('SM_TABLE.EMAIL'),
					type: 'email',
					class: 'email-column',
					width: '20%'
				},
				averageIncome: {
					title: this.getTranslation('SM_TABLE.INCOME'),
					type: 'custom',
					filter: false,
					class: 'text-center',
					width: '10%',
					renderComponent: EmployeeAverageIncomeComponent
				},
				averageExpenses: {
					title: this.getTranslation('SM_TABLE.EXPENSES'),
					type: 'custom',
					filter: false,
					class: 'text-center',
					width: '10%',
					renderComponent: EmployeeAverageExpensesComponent
				},
				averageBonus: {
					title: this.getTranslation('SM_TABLE.BONUS_AVG'),
					type: 'custom',
					filter: false,
					class: 'text-center',
					width: '20%',
					renderComponent: EmployeeAverageBonusComponent
				},
				isTrackingEnabled: {
					title: this.getTranslation('SM_TABLE.TIME_TRACKING'),
					type: 'custom',
					class: 'text-center',
					width: '20%',
					renderComponent: EmployeeTimeTrackingStatusComponent,
					filter: false
				},
				workStatus: {
					title: this.getTranslation('SM_TABLE.WORK_STATUS'),
					type: 'custom',
					class: 'text-center',
					width: '20%',
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

	ngOnDestroy() { }
}

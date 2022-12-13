import {
	Component,
	OnDestroy,
	OnInit,
	TemplateRef,
	ViewChild
} from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import {
	InvitationTypeEnum,
	ComponentLayoutStyleEnum,
	IOrganization,
	EmployeeViewModel,
	CrudActionEnum,
	IEmployee,
	ITag
} from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Subject, firstValueFrom } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import {
	EmployeeEndWorkComponent,
	EmployeeMutationComponent,
	EmployeeStartWorkComponent
} from '../../@shared/employee';
import { InviteMutationComponent } from '../../@shared/invite/invite-mutation/invite-mutation.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import {
	PictureNameTagsComponent,
	TagsOnlyComponent
} from '../../@shared/table-components';
import {
	InputFilterComponent,
	TagsColorFilterComponent
} from '../../@shared/table-filters';
import { API_PREFIX, ComponentEnum } from '../../@core/constants';
import {
	PaginationFilterBaseComponent,
	IPaginationBase
} from '../../@shared/pagination/pagination-filter-base.component';
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
import { ServerDataSource } from '../../@core/utils/smart-table';
import { ToggleFilterComponent } from "../../@shared/table-filters";
import { DateFormatPipe } from '../../@shared/pipes';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './employees.component.html',
	styleUrls: ['./employees.component.scss']
})
export class EmployeesComponent extends PaginationFilterBaseComponent
	implements OnInit, OnDestroy {

	settingsSmartTable: object;
	smartTableSource: ServerDataSource;
	selectedEmployee: EmployeeViewModel;
	employees: EmployeeViewModel[] = [];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	bonusForSelectedMonth = 0;
	disableButton: boolean = true;
	includeDeleted: boolean = false;
	loading: boolean = false;
	organizationInvitesAllowed: boolean = false;
	private _refresh$: Subject<any> = new Subject();

	employeesTable: Ng2SmartTableComponent;
	@ViewChild('employeesTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.employeesTable = content;
			this.onChangedSource();
		}
	}

	/*
	 * Actions Buttons directive
	 */
	@ViewChild('actionButtons', { static: true })
	actionButtons: TemplateRef<any>;

	public organization: IOrganization;
	employees$: Subject<any> = this.subject$;

	constructor(
		private readonly employeesService: EmployeesService,
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		private readonly router: Router,
		private readonly toastrService: ToastrService,
		private readonly route: ActivatedRoute,
		public readonly translate: TranslateService,
		private readonly errorHandler: ErrorHandlingService,
		private readonly _employeeStore: EmployeeStore,
		private readonly http: HttpClient,
		private readonly _dateFormatPipe: DateFormatPipe
	) {
		super(translate);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();

		this.employees$
			.pipe(
				debounceTime(300),
				tap(() => this.clearItem()),
				tap(() => this.getEmployees()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.employees$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(
					({ invitesAllowed }) =>
						(this.organizationInvitesAllowed = invitesAllowed)
				),
				tap(() => this._refresh$.next(true)),
				tap(() => this.employees$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params: ParamMap) => !!params),
				filter(
					(params: ParamMap) => params.get('openAddDialog') === 'true'
				),
				debounceTime(1000),
				tap(() => this.add()),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(
					() =>
						this.dataLayoutStyle ===
						ComponentLayoutStyleEnum.CARDS_GRID
				),
				tap(() => this.refreshPagination()),
				tap(() => (this.employees = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.EMPLOYEES;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap(
					(componentLayout) =>
						(this.dataLayoutStyle = componentLayout)
				),
				tap(() => this.refreshPagination()),
				filter(
					(componentLayout) =>
						componentLayout === ComponentLayoutStyleEnum.CARDS_GRID
				),
				tap(() => (this.employees = [])),
				tap(() => this.employees$.next(true)),
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
		if (!this.organization) {
			return;
		}
		try {
			const { name } = this.organization;
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
						organization: name
					});
				});
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this._refresh$.next(true);
			this.employees$.next(true);
		}
	}

	edit(selectedItem?: EmployeeViewModel) {
		if (selectedItem) {
			this.selectEmployee({
				isSelected: true,
				data: selectedItem
			});
		}
		this.router.navigate([
			'/pages/employees/edit/',
			this.selectedEmployee.id
		]);
	}

	async invite() {
		const dialog = this.dialogService.open(InviteMutationComponent, {
			context: {
				invitationType: InvitationTypeEnum.EMPLOYEE
			}
		});
		await firstValueFrom(dialog.onClose);
	}

	/**
	 * Delete employee
	 *
	 * @param selectedItem
	 */
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
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						if (!this.organization) {
							return;
						}
						const { id: organizationId } = this.organization;
						await this.employeesService.delete(this.selectedEmployee.id, {
							organizationId
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
						this._refresh$.next(true);
						this.employees$.next(true);
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
			const { id: organizationId } = this.organization;
			const { tenantId } = this.store.user;

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
					data,
					{
						organizationId,
						tenantId
					}
				);
				this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_INACTIVE', {
					name: this.selectedEmployee.fullName.trim()
				});
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this._refresh$.next(true);
			this.employees$.next(true);
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
			const { id: organizationId } = this.organization;
			const { tenantId } = this.store.user;

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
					null,
					{
						organizationId,
						tenantId
					}
				);
				this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_ACTIVE', {
					name: this.selectedEmployee.fullName.trim()
				});
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this._refresh$.next(true);
			this.employees$.next(true);
		}
	}

	/**
	 * Restore deleted employee
	 *
	 * @param selectedItem
	 */
	async restoreToWork(selectedItem?: EmployeeViewModel) {
		if (!this.organization) {
			return;
		}
		if (selectedItem) {
			this.selectEmployee({
				isSelected: true,
				data: selectedItem
			});
		}
		try {
			const { id: organizationId } = this.organization;
			const { tenantId } = this.store.user;

			await this.employeesService.resort(this.selectedEmployee.id, {
				organizationId,
				tenantId
			});
			this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_ACTIVE', {
				name: this.selectedEmployee.fullName.trim()
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this._refresh$.next(true);
			this.employees$.next(true);
		}
	}

	/**
	 * Enabled/Disabled Time Tracking Status for each employee
	 *
	 * @param selectedItem
	 */
	async timeTrackingAction(selectedItem?: EmployeeViewModel) {
		if (selectedItem) {
			this.selectEmployee({
				isSelected: true,
				data: selectedItem
			});
		}
		try {
			const { id: organizationId } = this.organization;
			const { tenantId } = this.store.user;

			const { isTrackingEnabled } = this.selectedEmployee;
			await this.employeesService.setEmployeeTimeTrackingStatus(
				this.selectedEmployee.id,
				!isTrackingEnabled,
				{
					organizationId,
					tenantId
				}
			);

			if (isTrackingEnabled) {
				this.toastrService.success(
					'TOASTR.MESSAGE.EMPLOYEE_TIME_TRACKING_DISABLED',
					{
						name: this.selectedEmployee.fullName.trim()
					}
				);
			} else {
				this.toastrService.success(
					'TOASTR.MESSAGE.EMPLOYEE_TIME_TRACKING_ENABLED',
					{
						name: this.selectedEmployee.fullName.trim()
					}
				);
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this._refresh$.next(true);
			this.employees$.next(true);
		}
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}
		this.loading = true;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.smartTableSource = new ServerDataSource(this.http, {
			endPoint: `${API_PREFIX}/employee/pagination`,
			relations: ['user', 'tags'],
			withDeleted: this.includeDeleted,
			where: {
				organizationId,
				tenantId,
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (employee: IEmployee) => {
				return Object.assign(
					{},
					employee,
					this.employeeMapper(employee)
				);
			},
			finalize: () => {
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
				this.loading = false;
			}
		});
	}

	private async getEmployees() {
		if (!this.organization) {
			return;
		}
		try {
			this.setSmartTableSource();
			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this.smartTableSource.getElements();
				this.employees.push(
					...this.smartTableSource.getData()
				);
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	private employeeMapper(employee: IEmployee) {
		const {
			id,
			user,
			isActive,
			endWork,
			tags,
			averageIncome,
			averageExpenses,
			averageBonus,
			startedWorkOn,
			isTrackingEnabled,
			isDeleted
		} = employee;

		/**
		 * "Range" when was hired and when exit
		 */
		const start = this._dateFormatPipe.transform(startedWorkOn, null, 'LL');
		const end = this._dateFormatPipe.transform(endWork, null, 'LL');
		const workStatus = [start, end].filter(Boolean).join(' - ');

		return {
			fullName: `${user.name}`,
			email: user.email,
			id,
			isActive,
			endWork: endWork ? new Date(endWork) : '',
			workStatus: endWork ? workStatus : '',
			imageUrl: user.imageUrl,
			tags,
			// TODO: load real bonus and bonusDate
			bonus: this.bonusForSelectedMonth,
			averageIncome: Math.floor(averageIncome),
			averageExpenses: Math.floor(averageExpenses),
			averageBonus: Math.floor(averageBonus),
			bonusDate: Date.now(),
			startedWorkOn,
			isTrackingEnabled,
			isDeleted
		};
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : this.minItemPerPage
			},
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.EMPLOYEE'),
			columns: {
				fullName: {
					title: this.getTranslation('SM_TABLE.FULL_NAME'),
					type: 'custom',
					class: 'align-row',
					width: '20%',
					renderComponent: PictureNameTagsComponent,
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (name: string) => {
						this.setFilter({ field: 'user.name', search: name });
					}
				},
				email: {
					title: this.getTranslation('SM_TABLE.EMAIL'),
					type: 'email',
					class: 'email-column',
					width: '20%',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (email: string) => {
						this.setFilter({ field: 'user.email', search: email });
					}
				},
				averageIncome: {
					title: this.getTranslation('SM_TABLE.INCOME'),
					type: 'custom',
					filter: false,
					class: 'text-center',
					width: '5%',
					renderComponent: EmployeeAverageIncomeComponent
				},
				averageExpenses: {
					title: this.getTranslation('SM_TABLE.EXPENSES'),
					type: 'custom',
					filter: false,
					class: 'text-center',
					width: '5%',
					renderComponent: EmployeeAverageExpensesComponent
				},
				averageBonus: {
					title: this.getTranslation('SM_TABLE.BONUS_AVG'),
					type: 'custom',
					filter: false,
					class: 'text-center',
					width: '5%',
					renderComponent: EmployeeAverageBonusComponent
				},
				isTrackingEnabled: {
					title: this.getTranslation('SM_TABLE.TIME_TRACKING'),
					type: 'custom',
					class: 'text-center',
					width: '5%',
					renderComponent: EmployeeTimeTrackingStatusComponent,
					filter: {
						type: 'custom',
						component: ToggleFilterComponent
					},
					filterFunction: (checked: boolean) => {
						this.setFilter({ field: 'isTrackingEnabled', search: checked });
					}
				},
				tags: {
					title: this.getTranslation('SM_TABLE.TAGS'),
					type: 'custom',
					width: '20%',
					renderComponent: TagsOnlyComponent,
					filter: {
						type: 'custom',
						component: TagsColorFilterComponent
					},
					filterFunction: (tags: ITag[]) => {
						const tagIds = [];
						for (const tag of tags) {
							tagIds.push(tag.id);
						}
						this.setFilter({ field: 'tags', search: tagIds });
					},
					sort: false
				},
				workStatus: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					class: 'text-center',
					width: '20%',
					renderComponent: EmployeeWorkStatusComponent,
					filter: {
						type: 'custom',
						component: ToggleFilterComponent
					},
					filterFunction: (isActive: boolean) => {
						this.setFilter({ field: 'isActive', search: isActive });
					}
				}
			}
		};
	}

	changeIncludeDeleted(checked: boolean) {
		this.includeDeleted = checked;
		this._refresh$.next(true);
		this.employees$.next(true);
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

	async startEmployeeWork() {
		try {
			const {id: organizationId} = this.organization;
			const {tenantId} = this.store.user;

			const dialog = this.dialogService.open(EmployeeStartWorkComponent, {
				context: {
					employeeFullName: this.selectedEmployee.fullName
				}
			});
			const data = await firstValueFrom(dialog.onClose);
			if (data) {
				await this.employeesService.setEmployeeStartWork(
					this.selectedEmployee.id,
					data,
					{
						organizationId,
						tenantId
					}
				);
				this.toastrService.success(this.getTranslation('TOASTR.MESSAGE.AUTHORIZED_TO_WORK', {
						name: this.selectedEmployee.fullName.trim()
					}
				), {
					name: this.selectedEmployee.fullName.trim()
				});
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this._refresh$.next(true);
			this.employees$.next(true);
		}
	}

	ngOnDestroy(): void {}
}

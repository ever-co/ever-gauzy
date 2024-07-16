import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Cell } from 'angular2-smart-table';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Subject, firstValueFrom } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	EmployeeStore,
	EmployeesService,
	ErrorHandlingService,
	ServerDataSource,
	ToastrService
} from '@gauzy/ui-core/core';
import {
	InvitationTypeEnum,
	ComponentLayoutStyleEnum,
	IOrganization,
	EmployeeViewModel,
	CrudActionEnum,
	IEmployee,
	ITag,
	PermissionsEnum
} from '@gauzy/contracts';
import { API_PREFIX, ComponentEnum, Store, distinctUntilChange } from '@gauzy/ui-core/common';
import {
	AllowScreenshotCaptureComponent,
	CardGridComponent,
	DateFormatPipe,
	DeleteConfirmationComponent,
	EmployeeEndWorkComponent,
	EmployeeMutationComponent,
	EmployeeStartWorkComponent,
	InputFilterComponent,
	InviteMutationComponent,
	PictureNameTagsComponent,
	TagsColorFilterComponent,
	TagsOnlyComponent,
	ToggleFilterComponent
} from '@gauzy/ui-core/shared';
import { PaginationFilterBaseComponent, IPaginationBase } from '@gauzy/ui-core/shared';
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
export class EmployeesComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	settingsSmartTable: object;
	smartTableSource: ServerDataSource;
	selectedEmployee: EmployeeViewModel;
	employees: EmployeeViewModel[] = [];
	viewComponentName: ComponentEnum = ComponentEnum.EMPLOYEES;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	bonusForSelectedMonth = 0;
	disableButton: boolean = true;
	includeDeleted: boolean = false;
	loading: boolean = false;
	organizationInvitesAllowed: boolean = false;

	private _grid: CardGridComponent;
	@ViewChild('grid') set grid(content: CardGridComponent) {
		if (content) {
			this._grid = content;
		}
	}

	/*
	 * Actions Buttons directive
	 */
	@ViewChild('actionButtons', { static: true })
	actionButtons: TemplateRef<any>;

	public organization: IOrganization;
	public refresh$: Subject<any> = new Subject();
	public employees$: Subject<any> = this.subject$;

	constructor(
		public readonly translateService: TranslateService,
		private readonly employeesService: EmployeesService,
		private readonly dialogService: NbDialogService,
		private readonly store: Store,
		private readonly router: Router,
		private readonly toastrService: ToastrService,
		private readonly route: ActivatedRoute,
		private readonly errorHandler: ErrorHandlingService,
		private readonly _employeeStore: EmployeeStore,
		private readonly http: HttpClient,
		private readonly _dateFormatPipe: DateFormatPipe
	) {
		super(translateService);
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
				tap(({ invitesAllowed }) => (this.organizationInvitesAllowed = invitesAllowed)),
				tap(() => this._additionalColumns()),
				tap(() => this.refresh$.next(true)),
				tap(() => this.employees$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params: ParamMap) => !!params),
				filter((params: ParamMap) => params.get('openAddDialog') === 'true'),
				debounceTime(1000),
				tap(() => this.add()),
				untilDestroyed(this)
			)
			.subscribe();
		this.refresh$
			.pipe(
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => (this.employees = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Checks if the current user has the necessary permissions to perform button actions.
	 * @returns A boolean indicating whether the user has the required permissions.
	 */
	haveBtnActionPermissions(): boolean {
		return !this.store.hasAllPermissions(PermissionsEnum.ORG_EMPLOYEES_EDIT, PermissionsEnum.ORG_INVITE_EDIT);
	}

	/**
	 *
	 */
	setView() {
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.employees = [])),
				tap(() => this.employees$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Selects an employee based on the given parameters.
	 * @param param0 Object containing selection information.
	 */
	selectEmployee({ isSelected, data }): void {
		// Update selected employee and button state
		this.selectedEmployee = isSelected ? data : null;
		this.disableButton = !isSelected;

		// Check if using cards grid and custom component instance is AllowScreenshotCaptureComponent
		if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID && this._grid) {
			const customComponentInstance = this._grid.customComponentInstance();

			// Handle AllowScreenshotCaptureComponent specific logic
			if (customComponentInstance?.constructor === AllowScreenshotCaptureComponent) {
				this.disableButton = true;
				const instance: AllowScreenshotCaptureComponent = customComponentInstance;
				this._updateAllowScreenshotCapture(instance.rowData, !instance.allowed);
				this._grid.clearCustomViewComponent();
				this.clearItem();
			}
		}
	}

	/**
	 * Add multiple employees to the organization.
	 * Handles dialog response, displays success toast on employee addition,
	 * and refreshes UI after completion.
	 */
	async add(): Promise<void> {
		// Check if organization is defined
		if (!this.organization) {
			return;
		}

		try {
			const { name } = this.organization;

			// Open employee mutation dialog
			const dialog = this.dialogService.open(EmployeeMutationComponent);

			// Wait for dialog response
			const response = await firstValueFrom(dialog.onClose);

			// Process response if available
			if (response) {
				response.forEach((employee: IEmployee) => {
					const { firstName, lastName } = employee.user;
					const fullName = firstName && lastName ? `${firstName} ${lastName}` : 'Employee';

					this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_ADDED', {
						name: fullName,
						organization: name
					});
				});
			}
		} catch (error) {
			// Handle errors
			this.errorHandler.handleError(error);
		} finally {
			// Refresh UI
			this.refresh$.next(true);
			this.employees$.next(true);
		}
	}
	/**
	 * Navigates to the edit page for the selected employee if available.
	 * If no employee is selected, navigates to the default edit page.
	 * @param selectedItem The employee view model to edit
	 */
	edit(selectedItem?: EmployeeViewModel): void {
		if (selectedItem) {
			// Select the employee
			this.selectEmployee({
				isSelected: true,
				data: selectedItem
			});
			// Navigate to edit page for the selected employee
			this.router.navigate(['/pages/employees/edit', selectedItem.id]);
		} else if (this.selectedEmployee) {
			// Navigate to edit page for the currently selected employee
			this.router.navigate(['/pages/employees/edit', this.selectedEmployee.id]);
		}
	}

	/**
	 * Opens an invitation dialog for adding new employees.
	 * Waits for the dialog to close before proceeding.
	 */
	async invite(): Promise<void> {
		try {
			const dialog = this.dialogService.open(InviteMutationComponent, {
				context: { invitationType: InvitationTypeEnum.EMPLOYEE }
			});
			await firstValueFrom(dialog.onClose);
			// Optionally handle any post-invitation logic here
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	/**
	 * Deletes the selected employee after confirmation.
	 *
	 * @param selectedItem The employee view model to delete.
	 */
	async delete(selectedItem?: EmployeeViewModel): Promise<void> {
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
			const confirmationDialog = this.dialogService.open(DeleteConfirmationComponent, {
				context: {
					recordType: `${this.selectedEmployee.fullName} ${this.getTranslation(
						'FORM.DELETE_CONFIRMATION.EMPLOYEE'
					)}`
				}
			});

			confirmationDialog.onClose.pipe(untilDestroyed(this)).subscribe(async (result) => {
				if (result) {
					const { id: organizationId, tenantId } = this.organization;

					await this.employeesService.softRemove(this.selectedEmployee.id, { organizationId, tenantId });

					this._employeeStore.employeeAction = {
						action: CrudActionEnum.DELETED,
						employees: [this.selectedEmployee as any]
					};

					const name = this.selectedEmployee.fullName.trim() || 'Unknown Employee';
					this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_INACTIVE', { name });
				}
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.refresh$.next(true);
			this.employees$.next(true);
		}
	}

	/**
	 * Ends work for the selected employee after confirmation.
	 *
	 * @param selectedItem The employee view model for which work is ended.
	 */
	async endWork(selectedItem?: EmployeeViewModel): Promise<void> {
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
			const { id: organizationId, tenantId } = this.organization;
			const dialog = this.dialogService.open(EmployeeEndWorkComponent, {
				context: {
					endWorkValue: this.selectedEmployee.endWork,
					employeeFullName: this.selectedEmployee.fullName
				}
			});

			const data = await firstValueFrom(dialog.onClose);

			if (data) {
				await this.employeesService.setEmployeeEndWork(this.selectedEmployee.id, data, {
					organizationId,
					tenantId
				});

				const name = this.selectedEmployee.fullName.trim() || 'Unknown Employee';
				this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_INACTIVE', {
					name
				});
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.refresh$.next(true);
			this.employees$.next(true);
		}
	}

	/**
	 * Brings the selected employee back to work after confirmation.
	 *
	 * @param selectedItem The employee view model for which work is resumed.
	 */
	async backToWork(selectedItem?: EmployeeViewModel): Promise<void> {
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
			const { id: organizationId, tenantId } = this.organization;
			const dialog = this.dialogService.open(EmployeeEndWorkComponent, {
				context: {
					backToWork: true,
					employeeFullName: this.selectedEmployee.fullName
				}
			});

			const data = await firstValueFrom(dialog.onClose);

			if (data) {
				await this.employeesService.setEmployeeEndWork(this.selectedEmployee.id, null, {
					organizationId,
					tenantId
				});

				const name = this.selectedEmployee.fullName.trim() || 'Unknown Employee';
				this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_ACTIVE', {
					name
				});
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.refresh$.next(true);
			this.employees$.next(true);
		}
	}

	/**
	 * Restore deleted employee to active status.
	 *
	 * @param selectedItem The employee view model to restore.
	 */
	async restoreToWork(selectedItem?: EmployeeViewModel): Promise<void> {
		if (!this.organization || !selectedItem) {
			return;
		}

		this.selectEmployee({
			isSelected: true,
			data: selectedItem
		});

		try {
			const { id: organizationId, tenantId } = this.organization;

			await this.employeesService.softRecover(this.selectedEmployee.id, {
				organizationId,
				tenantId
			});

			const name = this.selectedEmployee.fullName.trim() || 'Unknown Employee';
			this.toastrService.success('TOASTR.MESSAGE.EMPLOYEE_ACTIVE', {
				name
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.refresh$.next(true);
			this.employees$.next(true);
		}
	}

	/**
	 * Enable or disable time tracking status for the selected employee.
	 *
	 * @param selectedItem The employee view model to perform time tracking action on.
	 */
	async timeTrackingAction(selectedItem?: EmployeeViewModel): Promise<void> {
		if (!selectedItem || !this.organization) {
			return;
		}

		this.selectEmployee({
			isSelected: true,
			data: selectedItem
		});

		try {
			const { id: organizationId, tenantId } = this.organization;
			const { isTrackingEnabled } = this.selectedEmployee;

			const fullName = this.selectedEmployee.fullName.trim() || 'Unknown Employee';

			await this.employeesService.setEmployeeTimeTrackingStatus(this.selectedEmployee.id, !isTrackingEnabled, {
				organizationId,
				tenantId
			});

			const toastMessageKey = isTrackingEnabled
				? 'TOASTR.MESSAGE.EMPLOYEE_TIME_TRACKING_DISABLED'
				: 'TOASTR.MESSAGE.EMPLOYEE_TIME_TRACKING_ENABLED';

			this.toastrService.success(toastMessageKey, { name: fullName });
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.refresh$.next(true);
			this.employees$.next(true);
		}
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return; // Early exit if organization is undefined
		}

		try {
			this.loading = true; // Indicate loading state
			const { id: organizationId, tenantId } = this.organization;

			this.smartTableSource = new ServerDataSource(this.http, {
				endPoint: `${API_PREFIX}/employee/pagination`,
				relations: ['user', 'tags'],
				withDeleted: this.includeDeleted, // Include soft-deleted records if flag is true
				where: {
					organizationId,
					tenantId,
					...(this.filters.where ? this.filters.where : {}) // Include additional filter conditions
				},
				resultMap: (employee: IEmployee) => {
					return {
						...employee, // Spread employee properties
						...this.employeeMapper(employee) // Map additional properties
					};
				},
				finalize: () => {
					this.updatePagination(this.smartTableSource.count());
					this.loading = false; // Update loading state
				}
			});
		} finally {
			this.loading = false; // Update loading state
		}
	}

	/**
	 * Update pagination information
	 * @param totalItems - Total items returned from the server
	 */
	updatePagination(totalItems: number) {
		this.setPagination({
			...this.getPagination(),
			totalItems
		});
	}

	/**
	 * Fetch and display employees based on current organization settings and layout style.
	 */
	private async getEmployees(): Promise<void> {
		try {
			if (!this.organization) {
				return;
			}

			this.setSmartTableSource();

			// Configure pagination
			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			// Fetch elements based on layout style
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this.smartTableSource.getElements();
				this.employees.push(...this.smartTableSource.getData());
			}
		} catch (error) {
			this.errorHandler.handleError(error); // Example: Use your error handling service or method here
		}
	}

	/**
	 *
	 * @param employee
	 * @returns
	 */
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
			employeeId: id,
			startedWorkOn,
			isTrackingEnabled,
			isDeleted
		};
	}

	/**
	 * Load Smart Table settings
	 */
	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			selectedRowIndex: -1,
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
					componentInitFunction: (instance: PictureNameTagsComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getRawValue();
					},
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value: string) => {
						this.setFilter({ field: 'user.name', search: value });
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
					filterFunction: (value: string) => {
						this.setFilter({ field: 'user.email', search: value });
					}
				},
				averageIncome: {
					title: this.getTranslation('SM_TABLE.INCOME'),
					type: 'custom',
					filter: false,
					class: 'text-center',
					width: '5%',
					renderComponent: EmployeeAverageIncomeComponent,
					componentInitFunction: (instance: EmployeeAverageIncomeComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				averageExpenses: {
					title: this.getTranslation('SM_TABLE.EXPENSES'),
					type: 'custom',
					filter: false,
					class: 'text-center',
					width: '5%',
					renderComponent: EmployeeAverageExpensesComponent,
					componentInitFunction: (instance: EmployeeAverageExpensesComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				averageBonus: {
					title: this.getTranslation('SM_TABLE.BONUS_AVG'),
					type: 'custom',
					filter: false,
					class: 'text-center',
					width: '5%',
					renderComponent: EmployeeAverageBonusComponent,
					componentInitFunction: (instance: EmployeeAverageBonusComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				isTrackingEnabled: {
					title: this.getTranslation('SM_TABLE.TIME_TRACKING'),
					type: 'custom',
					class: 'text-center',
					width: '5%',
					renderComponent: EmployeeTimeTrackingStatusComponent,
					componentInitFunction: (instance: EmployeeTimeTrackingStatusComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					},
					filter: {
						type: 'custom',
						component: ToggleFilterComponent
					},
					filterFunction: (checked: boolean) => {
						this.setFilter({
							field: 'isTrackingEnabled',
							search: checked
						});
					}
				},
				tags: {
					title: this.getTranslation('SM_TABLE.TAGS'),
					type: 'custom',
					width: '20%',
					renderComponent: TagsOnlyComponent,
					componentInitFunction: (instance: TagsOnlyComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					},
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
					width: '5%',
					renderComponent: EmployeeWorkStatusComponent,
					componentInitFunction: (instance: EmployeeWorkStatusComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					},
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

	/**
	 * Adds an additional column to the Smart Table settings based on the organization's configuration.
	 * This method checks if screenshot capture is allowed and configures the Smart Table accordingly.
	 */
	private _additionalColumns(): void {
		// Check if organization context is available
		if (!this.organization) {
			return;
		}

		// Destructure properties for clarity
		const { allowScreenshotCapture } = this.organization;

		// Check if screenshot capture is allowed
		if (allowScreenshotCapture) {
			// Configure the additional column for screenshot capture
			this.settingsSmartTable['columns']['allowScreenshotCapture'] = {
				title: this.getTranslation('SM_TABLE.SCREEN_CAPTURE'),
				type: 'custom',
				class: 'text-center',
				editable: false,
				addable: false,
				notShownField: true,
				// Configure custom filter for the column
				filter: {
					type: 'custom',
					component: ToggleFilterComponent
				},
				// Define filter function to update the filter settings
				filterFunction: (isEnable: boolean) => {
					this.setFilter({
						field: 'allowScreenshotCapture',
						search: isEnable
					});
				},
				// Configure custom component for rendering the column
				renderComponent: AllowScreenshotCaptureComponent,
				// Initialize component function to set initial values
				componentInitFunction: (instance: AllowScreenshotCaptureComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
					instance.value = cell.getValue();

					// Subscribe to the allowScreenshotCaptureChange event
					instance.allowScreenshotCaptureChange.subscribe({
						next: (isAllow: boolean) => {
							// Clear selected items and update allowScreenshotCapture
							this.clearItem();
							this._updateAllowScreenshotCapture(instance.rowData, isAllow);
						},
						error: (err: any) => {
							console.warn(err);
						}
					});
				}
			};
		}

		// Copy the settingsSmartTable to trigger change detection
		this.settingsSmartTable = { ...this.settingsSmartTable };
	}

	/**
	 * Update the allowScreenshotCapture setting for an employee.
	 *
	 * @param employee The employee to update.
	 * @param isAllowed Boolean indicating if screenshot capture is allowed.
	 */
	private async _updateAllowScreenshotCapture(employee: IEmployee, isAllowed: boolean): Promise<void> {
		try {
			const { id: organizationId, tenantId } = this.organization;
			const name = employee.fullName.trim() || 'Unknown Employee';

			await this.employeesService.update(employee.id, {
				allowScreenshotCapture: isAllowed,
				organizationId,
				tenantId
			}); // Await the update operation

			this.toastrService.success('TOASTR.MESSAGE.SCREEN_CAPTURE_CHANGED', { name });
		} catch (error) {
			this.errorHandler.handleError(error); // Handle errors using your error handling service or method
		}
	}

	/**
	 * Change the includeDeleted flag and trigger refresh signals.
	 *
	 * @param checked Boolean indicating if deleted items should be included.
	 */
	changeIncludeDeleted(checked: boolean): void {
		this.includeDeleted = checked;
		this.refresh$.next(true);
		this.employees$.next(true);
	}

	/**
	 *	Apply translation on Smart Table
	 */
	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				tap(() => this._additionalColumns()),
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
	}

	/**
	 * Start employee's work process.
	 */
	async startEmployeeWork() {
		try {
			const { id: organizationId, tenantId } = this.organization;
			const name = this.selectedEmployee.fullName.trim() || 'Unknown Employee';

			const dialog = this.dialogService.open(EmployeeStartWorkComponent, {
				context: { employeeFullName: name }
			});
			const data = await firstValueFrom(dialog.onClose);
			if (data) {
				await this.employeesService.setEmployeeStartWork(this.selectedEmployee.id, data, {
					organizationId,
					tenantId
				});

				this.toastrService.success('TOASTR.MESSAGE.AUTHORIZED_TO_WORK', { name });
			}
		} catch (error) {
			this.errorHandler.handleError(error);
		} finally {
			this.refresh$.next(true);
			this.employees$.next(true);
		}
	}

	ngOnDestroy(): void {}
}

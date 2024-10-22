import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Cell, IColumns, Settings } from 'angular2-smart-table';
import { Subject, debounceTime, filter, firstValueFrom, tap } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	EmployeeStore,
	EmployeesService,
	ErrorHandlingService,
	PageDataTableRegistryService,
	ServerDataSource,
	Store,
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
import { API_PREFIX, ComponentEnum, distinctUntilChange } from '@gauzy/ui-core/common';
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
	PaginationFilterBaseComponent,
	PictureNameTagsComponent,
	TagsColorFilterComponent,
	TagsOnlyComponent,
	ToggleFilterComponent
} from '@gauzy/ui-core/shared';
import {
	EmployeeAverageBonusComponent,
	EmployeeAverageExpensesComponent,
	EmployeeAverageIncomeComponent,
	EmployeeTimeTrackingStatusComponent,
	EmployeeWorkStatusComponent
} from './table-components';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-employees-list',
	templateUrl: './employees.component.html',
	styleUrls: ['./employees.component.scss']
})
export class EmployeesComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	public settingsSmartTable: Settings;
	public smartTableSource: ServerDataSource;
	public selectedEmployee: EmployeeViewModel;
	public employees: EmployeeViewModel[] = [];
	public viewComponentName: ComponentEnum = ComponentEnum.EMPLOYEES;
	public PermissionsEnum = PermissionsEnum;
	public dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	public componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	public bonusForSelectedMonth = 0;
	public disableButton: boolean = true;
	public includeDeleted: boolean = false;
	public loading: boolean = false;
	public organization: IOrganization;
	public refresh$: Subject<any> = new Subject();
	public employees$: Subject<any> = this.subject$;

	private _grid: CardGridComponent;
	@ViewChild('grid') set grid(content: CardGridComponent) {
		if (content) {
			this._grid = content;
		}
	}

	/*
	 * Actions Buttons directive
	 */
	@ViewChild('actionButtons', { static: true }) actionButtons: TemplateRef<any>;

	constructor(
		public readonly translateService: TranslateService,
		private readonly _employeesService: EmployeesService,
		private readonly _dialogService: NbDialogService,
		private readonly _store: Store,
		private readonly _router: Router,
		private readonly _toastrService: ToastrService,
		private readonly _route: ActivatedRoute,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _employeeStore: EmployeeStore,
		private readonly _httpClient: HttpClient,
		private readonly _dateFormatPipe: DateFormatPipe,
		private readonly _pageDataTableRegistryService: PageDataTableRegistryService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._registerDataTableColumns();
		this._loadSmartTableSettings();
		this._subscribeToQueryParams();
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
		this._store.selectedOrganization$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._additionalColumns()),
				tap(() => this.refresh$.next(true)),
				tap(() => this.employees$.next(true)),
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

	ngAfterViewInit(): void {
		this._applyTranslationOnSmartTable();
	}

	/**
	 * Subscribes to the query parameters and performs actions based on the 'openAddDialog' parameter.
	 */
	private _subscribeToQueryParams(): void {
		this._route.queryParamMap
			.pipe(
				// Check if 'openAddDialog' is set to 'true' and filter out falsy values
				filter((params: ParamMap) => params?.get('openAddDialog') === 'true'),
				// Trigger the add method
				tap(() => this.add()),
				// Automatically unsubscribe when component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Checks if the current user has the necessary permissions to perform button actions.
	 * @returns A boolean indicating whether the user has the required permissions.
	 */
	haveBtnActionPermissions(): boolean {
		return !this._store.hasAllPermissions(PermissionsEnum.ORG_EMPLOYEES_EDIT, PermissionsEnum.ORG_INVITE_EDIT);
	}

	/**
	 * @description
	 * This method sets the view layout for the component based on the current layout configuration.
	 * It listens for layout changes from the store and updates the `dataLayoutStyle`.
	 * Depending on the layout (e.g., if it's `CARDS_GRID`), it clears the employee list and triggers a refresh.
	 */
	setView() {
		this._store
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

		const { name } = this.organization;

		// Open employee mutation dialog
		const dialog = this._dialogService.open(EmployeeMutationComponent);

		try {
			// Wait for dialog response
			const employees = await firstValueFrom(dialog.onClose);

			// Process response if available
			if (employees) {
				employees.forEach((employee: IEmployee) => {
					const { firstName, lastName } = employee.user;
					const fullName = firstName && lastName ? `${firstName} ${lastName}` : 'Unknown Employee';

					this._toastrService.success('TOASTR.MESSAGE.EMPLOYEE_ADDED', {
						name: fullName,
						organization: name
					});
				});
			}
		} catch (error) {
			// Handle errors
			console.log('Error while adding employee', error);
			this._errorHandlingService.handleError(error);
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
			this._router.navigate(['/pages/employees/edit', selectedItem.id]);
		} else if (this.selectedEmployee) {
			// Navigate to edit page for the currently selected employee
			this._router.navigate(['/pages/employees/edit', this.selectedEmployee.id]);
		}
	}

	/**
	 * Opens an invitation dialog for adding new employees.
	 * Waits for the dialog to close before proceeding.
	 */
	async invite(): Promise<void> {
		try {
			const dialog = this._dialogService.open(InviteMutationComponent, {
				context: { invitationType: InvitationTypeEnum.EMPLOYEE }
			});
			await firstValueFrom(dialog.onClose);
			// Optionally handle any post-invitation logic here
		} catch (error) {
			console.log('Error while inviting employee', error);
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Deletes the selected employee after confirmation.
	 *
	 * @param selectedItem The employee view model to delete.
	 */
	async delete(selectedItem?: EmployeeViewModel): Promise<void> {
		if (selectedItem) {
			this.selectEmployee({
				isSelected: true,
				data: selectedItem
			});
		}

		if (!this.organization || !this.selectedEmployee) {
			return;
		}

		const { id: organizationId, tenantId } = this.organization;
		const { fullName, id: employeeId } = this.selectedEmployee;

		// Open the delete confirmation dialog
		const confirmationDialog = this._dialogService.open(DeleteConfirmationComponent, {
			context: { recordType: `${fullName} ${this.getTranslation('FORM.DELETE_CONFIRMATION.EMPLOYEE')}` }
		});

		// Wait for the dialog to close
		confirmationDialog.onClose.pipe(untilDestroyed(this)).subscribe(async (result) => {
			if (result) {
				try {
					await this._employeesService.softRemove(employeeId, { organizationId, tenantId });

					this._employeeStore.employeeAction = {
						action: CrudActionEnum.DELETED,
						employees: [this.selectedEmployee as any]
					};

					// Get the full name of the selected employee
					const name = this.selectedEmployee.fullName.trim() || 'Unknown Employee';

					// Display a success toast message
					this._toastrService.success('TOASTR.MESSAGE.EMPLOYEE_INACTIVE', { name });
				} catch (error) {
					console.log('Error while deleting employee', error);
					this._errorHandlingService.handleError(error);
				} finally {
					this.refresh$.next(true);
					this.employees$.next(true);
				}
			}
		});
	}

	/**
	 * Ends work for the selected employee after confirmation.
	 *
	 * @param selectedItem The employee view model for which work is ended.
	 */
	async endWork(selectedItem?: EmployeeViewModel): Promise<void> {
		if (selectedItem) {
			this.selectEmployee({
				isSelected: true,
				data: selectedItem
			});
		}

		if (!this.organization || !this.selectedEmployee) {
			return;
		}

		const { id: organizationId, tenantId } = this.organization;

		// Open the end work dialog
		const dialog = this._dialogService.open(EmployeeEndWorkComponent, {
			context: {
				endWorkValue: this.selectedEmployee.endWork,
				employeeFullName: this.selectedEmployee.fullName
			}
		});

		try {
			const data = await firstValueFrom(dialog.onClose);

			if (!data) {
				return;
			}

			// Update the employee's endWork property
			await this._employeesService.setEmployeeEndWork(this.selectedEmployee.id, data, {
				organizationId,
				tenantId
			});

			// Get the full name of the selected employee
			const name = this.selectedEmployee.fullName.trim() || 'Unknown Employee';
			// Show a success toastr message
			this._toastrService.success('TOASTR.MESSAGE.EMPLOYEE_INACTIVE', { name });
		} catch (error) {
			console.log('Error while ending employee work', error);
			this._errorHandlingService.handleError(error);
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
		if (selectedItem) {
			this.selectEmployee({
				isSelected: true,
				data: selectedItem
			});
		}

		if (!this.organization || !this.selectedEmployee) {
			return;
		}

		const { id: organizationId, tenantId } = this.organization;

		// Open the end work dialog
		const dialog = this._dialogService.open(EmployeeEndWorkComponent, {
			context: {
				backToWork: true,
				employeeFullName: this.selectedEmployee.fullName
			}
		});

		const data = await firstValueFrom(dialog.onClose);

		if (!data) {
			return;
		}

		try {
			// Update the employee's endWork property
			await this._employeesService.setEmployeeEndWork(this.selectedEmployee.id, null, {
				organizationId,
				tenantId
			});

			// Get the full name of the selected employee
			const name = this.selectedEmployee.fullName.trim() || 'Unknown Employee';

			// Display a success toast message
			this._toastrService.success('TOASTR.MESSAGE.EMPLOYEE_ACTIVE', { name });
		} catch (error) {
			console.log('Error while backing employee work', error);
			this._errorHandlingService.handleError(error);
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
		this.selectEmployee({
			isSelected: true,
			data: selectedItem
		});

		if (!this.organization || !this.selectedEmployee) {
			return;
		}

		try {
			const { id: organizationId, tenantId } = this.organization;

			await this._employeesService.softRecover(this.selectedEmployee.id, {
				organizationId,
				tenantId
			});

			// Get the full name of the selected employee
			const name = this.selectedEmployee.fullName.trim() || 'Unknown Employee';

			// Display a success toast message
			this._toastrService.success('TOASTR.MESSAGE.EMPLOYEE_ACTIVE', { name });
		} catch (error) {
			this._errorHandlingService.handleError(error);
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
		this.selectEmployee({
			isSelected: true,
			data: selectedItem
		});

		if (!this.organization || !this.selectedEmployee) {
			return;
		}

		try {
			const { id: organizationId, tenantId } = this.organization;
			const { isTrackingEnabled } = this.selectedEmployee;

			// // Get the full name of the selected employee
			const name = this.selectedEmployee.fullName.trim() || 'Unknown Employee';

			// Update the employee's timeTrackingEnabled property
			await this._employeesService.setEmployeeTimeTrackingStatus(this.selectedEmployee.id, !isTrackingEnabled, {
				organizationId,
				tenantId
			});

			const toastMessageKey = isTrackingEnabled
				? 'TOASTR.MESSAGE.EMPLOYEE_TIME_TRACKING_DISABLED'
				: 'TOASTR.MESSAGE.EMPLOYEE_TIME_TRACKING_ENABLED';

			this._toastrService.success(toastMessageKey, { name });
		} catch (error) {
			console.log('Error while enabling/disabling time tracking', error);
			this._errorHandlingService.handleError(error);
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

			this.smartTableSource = new ServerDataSource(this._httpClient, {
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

			// Set paging
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			// Fetch elements based on layout style
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this.smartTableSource.getElements();
				this.employees.push(...this.smartTableSource.getData());
			}
		} catch (error) {
			console.log('Error while fetching employees', error);
			this._errorHandlingService.handleError(error); // Example: Use your error handling service or method here
		}
	}

	/**
	 * Maps an IEmployee object to a formatted employee object.
	 *
	 * @param employee The IEmployee object to map.
	 * @returns The formatted employee object.
	 */
	private employeeMapper(employee: IEmployee) {
		const {
			id,
			user: { name, email, imageUrl } = {},
			isActive,
			endWork,
			tags,
			averageIncome = 0,
			averageExpenses = 0,
			averageBonus = 0,
			startedWorkOn,
			isTrackingEnabled,
			isDeleted
		} = employee;

		// Format start and end work dates, and create the work status range
		const start = this._dateFormatPipe.transform(startedWorkOn, null, 'LL');
		const end = this._dateFormatPipe.transform(endWork, null, 'LL');
		const workStatus = [start, end].filter(Boolean).join(' - ');

		// Return the mapped object
		return {
			fullName: name || '', // Ensure default values for safety
			email: email || '',
			id,
			isActive,
			endWork: endWork ? new Date(endWork) : '',
			workStatus: endWork ? workStatus : '',
			imageUrl: imageUrl || '',
			tags: tags || [],
			bonus: this.bonusForSelectedMonth, // TODO: load real bonus and bonusDate
			averageIncome: Math.floor(averageIncome),
			averageExpenses: Math.floor(averageExpenses),
			averageBonus: Math.floor(averageBonus),
			bonusDate: Date.now(), // Placeholder for actual bonus date
			employeeId: id,
			employee,
			startedWorkOn,
			isTrackingEnabled,
			isDeleted
		};
	}

	/**
	 * Registers custom columns for the 'employee-manage' data table.
	 * This method defines and registers the columns with various properties,
	 * including a custom filter function and a rendering component.
	 */
	private _registerDataTableColumns(): void {
		// Register the data table column
		this._pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: 'employee-manage', // The identifier for the data table location
			columnId: 'fullName', // The identifier for the column
			order: 0, // The order of the column in the table
			title: () => this.getTranslation('SM_TABLE.FULL_NAME'), // The title of the column
			type: 'custom', // The type of the column
			class: 'align-row',
			width: '20%', // The width of the column
			isFilterable: true,
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
				return value.length > 0; // Return `true` if the value is non-empty, `false` otherwise
			}
		});

		// Register the data table column
		this._pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: 'employee-manage', // The identifier for the data table location
			columnId: 'email', // The identifier for the column
			order: 1, // The order of the column in the table
			title: () => this.getTranslation('SM_TABLE.EMAIL'), // The title of the column
			type: 'text', // The type of the column
			class: 'align-row',
			width: '20%', // The width of the column
			isFilterable: true,
			filter: {
				type: 'custom',
				component: InputFilterComponent
			},
			// Use the custom filter function, passing the instance context
			filterFunction: (value: string) => {
				this.setFilter({ field: 'user.email', search: value });
				return value.length > 0; // Return `true` if the value is non-empty, `false` otherwise
			}
		});

		// Register the data table column
		this._pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: 'employee-manage', // The identifier for the data table location
			columnId: 'averageIncome', // The identifier for the column
			order: 2, // The order of the column in the table
			title: () => this.getTranslation('SM_TABLE.INCOME'), // The title of the column
			type: 'custom', // The type of the column
			isFilterable: false, // Indicates whether the column is filterable
			isSortable: true, // Indicates whether the column is sortable
			class: 'text-center', // The class of the column
			width: '5%', // The width of the column
			renderComponent: EmployeeAverageIncomeComponent, // The component to render the column
			componentInitFunction: (instance: EmployeeAverageIncomeComponent, cell: Cell) => {
				instance.rowData = cell.getRow().getData();
			}
		});

		// Register the data table column
		this._pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: 'employee-manage', // The identifier for the data table location
			columnId: 'averageExpenses', // The identifier for the column
			order: 3, // The order of the column in the table
			title: () => this.getTranslation('SM_TABLE.EXPENSES'), // The title of the column
			type: 'custom', // The type of the column
			isFilterable: false, // Indicates whether the column is filterable
			isSortable: true, // Indicates whether the column is sortable
			class: 'text-center', // The class of the column
			width: '5%', // The width of the column
			renderComponent: EmployeeAverageExpensesComponent, // The component to render the column
			componentInitFunction: (instance: EmployeeAverageExpensesComponent, cell: Cell) => {
				instance.rowData = cell.getRow().getData();
			}
		});

		// Register the data table column
		this._pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: 'employee-manage', // The identifier for the data table location
			columnId: 'averageBonus', // The identifier for the column
			order: 4, // The order of the column in the table
			title: () => this.getTranslation('SM_TABLE.BONUS_AVG'), // The title of the column
			type: 'custom', // The type of the column
			isFilterable: false, // Indicates whether the column is filterable
			isSortable: true, // Indicates whether the column is sortable
			class: 'text-center', // The class of the column
			width: '5%', // The width of the column
			renderComponent: EmployeeAverageBonusComponent, // The component to render the column
			componentInitFunction: (instance: EmployeeAverageBonusComponent, cell: Cell) => {
				instance.rowData = cell.getRow().getData();
			}
		});

		// Register the data table column
		this._pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: 'employee-manage', // The identifier for the data table location
			columnId: 'isTrackingEnabled', // The identifier for the column
			order: 5, // The order of the column in the table
			title: () => this.getTranslation('SM_TABLE.TIME_TRACKING'), // The title of the column
			type: 'custom', // The type of the column
			isFilterable: true, // Indicates whether the column is filterable
			isSortable: true, // Indicates whether the column is sortable
			class: 'text-center', // The class of the column
			width: '5%', // The width of the column
			filter: {
				type: 'custom',
				component: ToggleFilterComponent
			},
			filterFunction: (isTrackingEnabled: boolean) => {
				this.setFilter({ field: 'isTrackingEnabled', search: isTrackingEnabled });
				return isTrackingEnabled;
			},
			renderComponent: EmployeeTimeTrackingStatusComponent, // The component to render the column
			componentInitFunction: (instance: EmployeeTimeTrackingStatusComponent, cell: Cell) => {
				instance.rowData = cell.getRow().getData();
			}
		});

		// Register the data table column
		this._pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: 'employee-manage', // The identifier for the data table location
			columnId: 'tags', // The identifier for the column
			order: 6, // The order of the column in the table
			title: () => this.getTranslation('SM_TABLE.TAGS'), // The title of the column
			type: 'custom', // The type of the column
			width: '20%', // The width of the column
			isFilterable: true, // Indicates whether the column is filterable
			isSortable: false,
			filter: {
				type: 'custom',
				component: TagsColorFilterComponent
			},
			filterFunction: (tags: ITag[]) => {
				// Extract tag IDs from the tags array
				const tagIds = tags.map((tag) => tag.id);
				// Set the filter to the tag IDs
				this.setFilter({ field: 'tags', search: tagIds });
				return tags.length > 0;
			},
			renderComponent: TagsOnlyComponent, // The component to render the column
			componentInitFunction: (instance: TagsOnlyComponent, cell: Cell) => {
				instance.rowData = cell.getRow().getData();
				instance.value = cell.getValue();
			}
		});

		// Register the data table column
		this._pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: 'employee-manage', // The identifier for the data table location
			columnId: 'workStatus', // The identifier for the column
			order: 7, // The order of the column in the table
			title: () => this.getTranslation('SM_TABLE.STATUS'), // The title of the column
			type: 'custom', // The type of the column
			class: 'text-center', // The class of the column
			width: '5%', // The width of the column
			isFilterable: true, // Indicates whether the column is filterable
			isSortable: false,
			filter: {
				type: 'custom',
				component: ToggleFilterComponent
			},
			filterFunction: (isActive: boolean) => {
				this.setFilter({ field: 'isActive', search: isActive });
				return isActive;
			},
			renderComponent: EmployeeWorkStatusComponent, // The component to render the column
			componentInitFunction: (instance: EmployeeWorkStatusComponent, cell: Cell) => {
				instance.rowData = cell.getRow().getData();
			}
		});
	}

	/**
	 * Retrieves the registered columns for the 'employee-manage' data table.
	 *
	 * This method fetches all the column configurations registered under the
	 * 'employee-manage' data table from the PageDataTableRegistryService.
	 * It returns the columns in the format of `IColumns`, which can be used for rendering or
	 * further manipulation in the smart table.
	 *
	 * @returns {IColumns} The column configurations for the 'employee-manage' table.
	 */
	getColumns(): IColumns {
		// Fetch and return the columns for 'employee-manage' data table
		return this._pageDataTableRegistryService.getPageDataTableColumns('employee-manage');
	}

	/**
	 * Load Smart Table settings
	 */
	private _loadSmartTableSettings() {
		// Get pagination settings
		const { itemsPerPage } = this.getPagination() || { itemsPerPage: this.minItemPerPage };

		// Configure Smart Table settings
		this.settingsSmartTable = {
			actions: false,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.EMPLOYEE'),
			pager: {
				display: false,
				perPage: itemsPerPage
			},
			columns: { ...this.getColumns() }
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

		// Check if screenshot capture is allowed and hide the column if not
		this._pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: 'employee-manage', // The identifier for the data table location
			columnId: 'allowScreenshotCapture', // The identifier for the column
			order: 8, // The order of the column in the table
			title: () => this.getTranslation('SM_TABLE.SCREEN_CAPTURE'), // The title of the column
			type: 'custom', // The type of the column
			class: 'text-center', // The class of the column
			width: '5%', // The width of the column
			isFilterable: true, // Indicates whether the column is filterable
			isSortable: false,
			hide: allowScreenshotCapture === false,
			filter: {
				type: 'custom',
				component: ToggleFilterComponent
			},
			filterFunction: (isEnable: boolean) => {
				this.setFilter({ field: 'allowScreenshotCapture', search: isEnable });
				return isEnable;
			},
			renderComponent: AllowScreenshotCaptureComponent, // The component to render the column
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
		});

		// Update the settingsSmartTable with the new columns
		this.settingsSmartTable = {
			...this.settingsSmartTable,
			columns: this.getColumns()
		};
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

			// Get the full name of the employee
			const name = employee.fullName.trim() || 'Unknown Employee';

			await this._employeesService.update(employee.id, {
				allowScreenshotCapture: isAllowed,
				organizationId,
				tenantId
			}); // Await the update operation

			this._toastrService.success('TOASTR.MESSAGE.SCREEN_CAPTURE_CHANGED', { name });
		} catch (error) {
			// Handle errors using your error handling service or method
			this._errorHandlingService.handleError(error);
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
		this.selectEmployee({ isSelected: false, data: null });
	}

	/**
	 * Start employee's work process.
	 */
	async startEmployeeWork() {
		if (!this.organization || !this.selectedEmployee) {
			return;
		}

		const { id: organizationId, tenantId } = this.organization;

		// Get the full name of the selected employee
		const name = this.selectedEmployee.fullName.trim() || 'Unknown Employee';

		// Open the start work dialog
		const dialog = this._dialogService.open(EmployeeStartWorkComponent, {
			context: { employeeFullName: name }
		});

		// Wait for the dialog to close
		const data = await firstValueFrom(dialog.onClose);

		if (!data) {
			return;
		}

		try {
			// Update the employee's startWork property
			await this._employeesService.setEmployeeStartWork(this.selectedEmployee.id, data, {
				organizationId,
				tenantId
			});

			// Get the full name of the selected employee
			this._toastrService.success('TOASTR.MESSAGE.AUTHORIZED_TO_WORK', { name });
		} catch (error) {
			console.log('Error while starting employee work', error);
			this._errorHandlingService.handleError(error);
		} finally {
			this.refresh$.next(true);
			this.employees$.next(true);
		}
	}

	ngOnDestroy(): void {}
}

import { AfterViewInit, Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, combineLatest, merge, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { NbTabComponent } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Cell } from 'angular2-smart-table';
import { NgxPermissionsService } from 'ngx-permissions';
import { ID, IEmployee, IOrganization, LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import { API_PREFIX, distinctUntilChange } from '@gauzy/ui-core/common';
import {
	PageDataTableRegistryService,
	EmployeesService,
	JobService,
	ServerDataSource,
	Store,
	ToastrService,
	PageTabsetRegistryId,
	PageTabRegistryService,
	PageDataTableRegistryId
} from '@gauzy/ui-core/core';
import { I18nService } from '@gauzy/ui-core/i18n';
import {
	EmployeeLinksComponent,
	IPaginationBase,
	NumberEditorComponent,
	PaginationFilterBaseComponent,
	SmartTableToggleComponent
} from '@gauzy/ui-core/shared';

/**
 * Job Employee Component
 */
export enum JobSearchTabsEnum {
	BROWSE = 'BROWSE',
	SEARCH = 'SEARCH',
	HISTORY = 'HISTORY'
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-job-employees',
	templateUrl: './job-employee.component.html',
	styleUrls: ['./job-employee.component.scss'],
	providers: [CurrencyPipe]
})
export class JobEmployeeComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit, OnDestroy {
	public tabsetId: PageTabsetRegistryId = this._route.snapshot.data.tabsetId; // The identifier for the tabset
	public dataTableId: PageDataTableRegistryId = this._route.snapshot.data.dataTableId; // The identifier for the data table
	public jobSearchTabsEnum = JobSearchTabsEnum;
	public loading: boolean = false;
	public settingsSmartTable: any;
	public employees$: Subject<any> = new Subject();
	public nbTab$: Subject<string> = new BehaviorSubject(JobSearchTabsEnum.BROWSE);
	public smartTableSource: ServerDataSource;
	public organization: IOrganization;
	public selectedEmployeeId: ID;
	public selectedEmployee: IEmployee;
	public disableButton: boolean = true;

	// Template References
	@ViewChild('tableLayout', { static: true }) tableLayout: TemplateRef<any>; // Template reference for the table layout tab
	@ViewChild('comingSoon', { static: true }) comingSoon: TemplateRef<any>; // Template reference for the coming soon tab

	constructor(
		translateService: TranslateService,
		private readonly _http: HttpClient,
		private readonly _route: ActivatedRoute,
		private readonly _router: Router,
		private readonly _ngxPermissionsService: NgxPermissionsService,
		private readonly _store: Store,
		private readonly _employeesService: EmployeesService,
		private readonly _jobService: JobService,
		private readonly _toastrService: ToastrService,
		private readonly _currencyPipe: CurrencyPipe,
		private readonly _i18nService: I18nService,
		readonly _pageDataTableRegistryService: PageDataTableRegistryService,
		readonly _pageTabRegistryService: PageTabRegistryService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.initializeUiPermissions(); // Initialize UI permissions
		this.initializeUiLanguagesAndLocale(); // Initialize UI languages and Update Locale
		this._initializePageElements(); // Register page elements
		this._applyTranslationOnSmartTable(); //
		this._loadSmartTableSettings(); // Load smart table settings
	}

	ngAfterViewInit(): void {
		// Subscribe to the employees$ observable with debounce time and untilDestroyed operators
		this.employees$
			.pipe(
				// Debounce the observable to wait for 100 milliseconds of inactivity
				debounceTime(100),
				// Perform side effect by triggering the getActiveJobEmployees method
				tap(() => this.getActiveJobEmployees()),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to the pagination$ observable with debounce time, distinctUntilChange, and untilDestroyed operators
		this.pagination$
			.pipe(
				// Debounce the observable to wait for 100 milliseconds of inactivity
				debounceTime(100),
				// Ensure that the value has changed before emitting it
				distinctUntilChange(),
				// Perform side effect by triggering the employees$ observable with true
				tap(() => this.employees$.next(true)),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Combine selectedOrganization$ and selectedEmployee$ observables
		const storeOrganization$ = this._store.selectedOrganization$;
		const storeEmployee$ = this._store.selectedEmployee$;

		// Subscribe to the combined observables with debounce time, distinctUntilChange, filter, tap, and untilDestroyed operators
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				// Debounce the observable to wait for 100 milliseconds of inactivity
				debounceTime(100),
				// Ensure that the value has changed before emitting it
				distinctUntilChange(),
				// Filter out combinations where organization is falsy
				filter(([organization]) => !!organization),
				// Perform side effects: update organization and selectedEmployeeId, trigger employees$ observable
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployeeId = employee ? employee.id : null;
				}),
				tap(() => this.employees$.next(true)),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Initializes page elements by registering page tabs and data table columns.
	 *
	 * This method centralizes the logic for setting up page-related configurations,
	 * ensuring that the necessary page tabs and data table columns are registered
	 * upon initialization.
	 */
	private _initializePageElements(): void {
		// Register page elements
		this.registerPageTabs(this._pageTabRegistryService); // Register page tabs
		this.registerDataTableColumns(this._pageDataTableRegistryService); // Register data table columns
	}

	/**
	 * Register page tabs for the JobEmployee
	 *
	 * @param _pageTabRegistryService
	 */
	registerPageTabs(_pageTabRegistryService: PageTabRegistryService): void {
		// Register the browse tab
		_pageTabRegistryService.registerPageTab({
			tabsetId: this.tabsetId, // The identifier for the tabset
			tabId: 'browse', // The identifier for the tab
			tabIcon: 'globe-2-outline', // The icon for the tab
			tabsetType: 'standard', // The type of tabset to use
			tabTitle: (_i18n) => _i18n.getTranslation('JOB_EMPLOYEE.BROWSE'), // The title for the tab
			order: 1, // The order of the tab,
			responsive: true, // Whether the tab is responsive,
			template: this.tableLayout // The template to be rendered in the tab
		});

		// Register the search tab
		_pageTabRegistryService.registerPageTab({
			tabsetId: this.tabsetId, // The identifier for the tabset
			tabId: 'search', // The identifier for the tab
			tabIcon: 'search-outline', // The icon for the tab
			tabsetType: 'standard', // The type of tabset to use
			tabTitle: (_i18n) => _i18n.getTranslation('JOB_EMPLOYEE.SEARCH'), // The title for the tab
			order: 2, // The order of the tab,
			responsive: true, // Whether the tab is responsive,
			template: this.comingSoon // The template to be rendered in the tab
		});

		// Register the history tab
		_pageTabRegistryService.registerPageTab({
			tabsetId: this.tabsetId, // The identifier for the tabset
			tabId: 'history', // The identifier for the tab
			tabIcon: 'clock-outline', // The icon for the tab
			tabsetType: 'standard', // The type of tabset to use
			tabTitle: (_i18n) => _i18n.getTranslation('JOB_EMPLOYEE.HISTORY'), // The title for the tab
			order: 3, // The order of the tab,
			responsive: true, // Whether the tab is responsive,
			template: this.comingSoon // The template to be rendered in the tab
		});
	}

	/**
	 * Register data table columns for the JobEmployee
	 *
	 * @param _pageDataTableRegistryService
	 */
	registerDataTableColumns(_pageDataTableRegistryService: PageDataTableRegistryService): void {
		// Register the data table column
		_pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: 'job-employee', // The identifier for the data table location
			columnId: 'name', // The identifier for the column
			order: 0, // The order of the column in the table
			title: () => this.getTranslation('JOB_EMPLOYEE.EMPLOYEE'), // The title of the column
			type: 'custom', // The type of the column
			width: '20%', // The width of the column
			isSortable: true, // Indicates whether the column is sortable
			isEditable: true, // Indicates whether the column is editable
			renderComponent: EmployeeLinksComponent,
			valuePrepareFunction: (_: any, cell: Cell) => this.prepareEmployeeValue(_, cell),
			componentInitFunction: (instance: EmployeeLinksComponent, cell: Cell) => {
				// Get the row data from the cell
				instance.rowData = cell.getRow().getData();
				// Get the value from the cell
				instance.value = cell.getValue();
			}
		});

		// Register the data table column
		_pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: 'job-employee', // The identifier for the data table location
			columnId: 'availableJobs', // The identifier for the column
			order: 1, // The order of the column in the table
			title: () => this.getTranslation('JOB_EMPLOYEE.AVAILABLE_JOBS'), // The title of the column
			type: 'text', // The type of the column
			width: '10%', // The width of the column
			isSortable: false, // Indicates whether the column is sortable
			isEditable: false, // Indicates whether the column is editable
			valuePrepareFunction: (rawValue: any) => rawValue || 0
		});

		// Register the data table column
		_pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: 'job-employee', // The identifier for the data table location
			columnId: 'appliedJobs', // The identifier for the column
			order: 2, // The order of the column in the table
			title: () => this.getTranslation('JOB_EMPLOYEE.APPLIED_JOBS'), // The title of the column
			type: 'text', // The type of the column
			width: '10%', // The width of the column
			isSortable: false, // Indicates whether the column is sortable
			isEditable: false, // Indicates whether the column is editable
			valuePrepareFunction: (rawValue: any) => rawValue || 0
		});

		// Register the data table column
		_pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: 'job-employee', // The identifier for the data table location
			columnId: 'billRateValue', // The identifier for the column
			order: 3, // The order of the column in the table
			title: () => this.getTranslation('JOB_EMPLOYEE.BILLING_RATE'), // The title of the column
			type: 'text', // The type of the column
			width: '10%', // The width of the column
			isSortable: false, // Indicates whether the column is sortable
			isEditable: true, // Indicates whether the column is editable
			editor: {
				type: 'custom',
				component: NumberEditorComponent
			},
			valuePrepareFunction: (rawValue: any, cell: Cell) => {
				// Get the employee data from the cell
				const employee: IEmployee = cell.getRow().getData();
				// Return the transformed value
				return this._currencyPipe.transform(rawValue, employee?.billRateCurrency);
			}
		});

		// Register the data table column
		_pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: 'job-employee', // The identifier for the data table location
			columnId: 'minimumBillingRate', // The identifier for the column
			order: 4, // The order of the column in the table
			title: () => this.getTranslation('JOB_EMPLOYEE.MINIMUM_BILLING_RATE'), // The title of the column
			type: 'text', // The type of the column
			width: '20%', // The width of the column
			isSortable: false, // Indicates whether the column is sortable
			isEditable: true, // Indicates whether the column is editable
			editor: {
				type: 'custom',
				component: NumberEditorComponent
			},
			valuePrepareFunction: (value: number, cell: Cell) => {
				const employee: IEmployee = cell.getRow().getData();
				return this._currencyPipe.transform(value, employee?.billRateCurrency);
			}
		});

		// Register the data table column
		_pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: 'job-employee', // The identifier for the data table location
			columnId: 'isJobSearchActive', // The identifier for the column
			order: 5, // The order of the column in the table
			title: () => this.getTranslation('JOB_EMPLOYEE.JOB_SEARCH_STATUS'), // The title of the column
			type: 'custom', // The type of the column
			width: '20%', // The width of the column
			isSortable: false, // Indicates whether the column is sortable
			isEditable: false, // Indicates whether the column is editable
			renderComponent: SmartTableToggleComponent,
			componentInitFunction: (instance: SmartTableToggleComponent, cell: Cell) => {
				// Get the employee data from the cell
				const employee: IEmployee = cell.getRow().getData();

				// Set the initial value of the toggle
				instance.value = employee.isJobSearchActive;

				// Subscribe to the toggleChange event
				instance.toggleChange.pipe(untilDestroyed(this)).subscribe((toggle: boolean) => {
					this.updateJobSearchAvailability(employee, toggle);
				});
			}
		});
	}

	/**
	 * Initialize UI permissions
	 */
	private initializeUiPermissions() {
		// Load permissions
		const permissions = this._store.userRolePermissions.map(({ permission }) => permission);
		this._ngxPermissionsService.flushPermissions(); // Flush permissions
		this._ngxPermissionsService.loadPermissions(permissions); // Load permissions
	}

	/**
	 * Initialize UI languages and Update Locale
	 */
	private initializeUiLanguagesAndLocale() {
		// Observable that emits when preferred language changes.
		const preferredLanguage$ = merge(this._store.preferredLanguage$, this._i18nService.preferredLanguage$).pipe(
			distinctUntilChange(),
			filter((preferredLanguage: LanguagesEnum) => !!preferredLanguage),
			untilDestroyed(this)
		);

		// Subscribe to preferred language changes
		preferredLanguage$.subscribe((preferredLanguage: string | LanguagesEnum) => {
			this.translateService.use(preferredLanguage);
		});
	}

	/**
	 * Registers and configures the Smart Table source.
	 */
	setSmartTableSource(): void {
		// Check if organization context is available
		if (!this.organization) {
			return;
		}

		// Set loading state to true while fetching data
		this.loading = true;

		try {
			// Destructure properties for clarity
			const { id: organizationId, tenantId } = this.organization;

			const whereClause = {
				tenantId,
				organizationId,
				isActive: true,
				isArchived: false,
				...(this.selectedEmployeeId ? { id: this.selectedEmployeeId } : {}),
				...(this.filters.where ? this.filters.where : {})
			};

			// Filter by current employee ID if the permission is not present
			if (!this._store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
				// Filter by current employee ID if the permission is not present
				const employeeId = this._store.user?.employee?.id;
				whereClause.id = employeeId;
			}

			// Create a new ServerDataSource for Smart Table
			this.smartTableSource = new ServerDataSource(this._http, {
				endPoint: `${API_PREFIX}/employee-job/statistics`,
				relations: ['user'],
				// Define query parameters for the API request
				where: { ...whereClause },
				// Finalize callback to handle post-processing
				finalize: () => {
					// Update pagination based on the count of items in the source
					this.setPagination({
						...this.getPagination(),
						totalItems: this.smartTableSource.count()
					});
				}
			});
		} catch (error) {
			// Display an error toastr notification in case of any exceptions.
			this._toastrService.danger(error);
		} finally {
			// Set loading state to false once data fetching is complete
			this.loading = false;
		}
	}

	/**
	 * Retrieves employees with active jobs.
	 *
	 * @returns {Promise<void>} - A Promise resolving to void.
	 */
	async getActiveJobEmployees(): Promise<void> {
		try {
			// Ensure the organization context is available before proceeding.
			if (!this.organization) {
				return;
			}

			// Set up the smart table source for displaying active job employees.
			this.setSmartTableSource();

			// Retrieve pagination settings.
			const { activePage, itemsPerPage } = this.getPagination();

			// Set paging for the smart table source.
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
		} catch (error) {
			// Display an error toastr notification in case of any exceptions.
			this._toastrService.danger(error);
		}
	}

	/**
	 * Loads the Smart Table settings.
	 */
	private _loadSmartTableSettings(): void {
		// Retrieve pagination settings
		const pagination: IPaginationBase = this.getPagination();

		// Configure smart table settings
		this.settingsSmartTable = {
			selectedRowIndex: -1,
			hideSubHeader: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.EMPLOYEE'),
			isEditable: true,
			actions: {
				delete: false,
				add: true
			},
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			edit: {
				editButtonContent: '<i class="nb-edit"></i>',
				saveButtonContent: '<i class="nb-checkmark"></i>',
				cancelButtonContent: '<i class="nb-close"></i>',
				confirmSave: true
			},
			columns: {
				...this._pageDataTableRegistryService.getPageDataTableColumns('job-employee')
			}
		};
	}

	/**
	 * Prepares the value for the employee cell.
	 * @param _ The row data.
	 * @param cell The cell to prepare the value for.
	 * @returns The prepared value.
	 */
	private prepareEmployeeValue(_: any, cell: Cell): any {
		// Get the employee data from the cell
		const employee: IEmployee | undefined = cell.getRow().getData();

		// Prepare the value for the cell
		if (employee) {
			const { user, id } = employee;
			return {
				name: user?.name ?? null,
				imageUrl: user?.imageUrl ?? null,
				id: id ?? null
			};
		}

		// Return default values if the employee is undefined
		return { name: null, imageUrl: null, id: null };
	}

	/**
	 * Handles the event for confirming the edit of an editable field.
	 *
	 * @param event - The event containing the edited data.
	 */
	async onEditConfirm(event: any): Promise<void> {
		try {
			// Ensure the organization context is available before proceeding.
			if (!this.organization) {
				return;
			}

			// Destructure properties for clarity.
			const { id: organizationId, tenantId } = this.organization;
			// Get the employee ID from the event data
			const employeeId = event.data?.id;
			// Get the new data from the event
			const { billRateValue, minimumBillingRate } = event.newData ?? {};

			// Update employee bill rates.
			await this._employeesService.updateProfile(employeeId, {
				minimumBillingRate: +minimumBillingRate,
				billRateValue: +billRateValue,
				tenantId,
				organizationId
			});

			// If successful, refresh the smart table source.
			this.employees$.next(true);
		} catch (error) {
			console.error('Error while updating employee rates', error);
			// If an error occurs, reject the edit and log the error.
			await event.confirm.reject();
		}
	}

	/**
	 * Updates the job search availability status of an employee within the organization.
	 * @param employee - The employee object to update.
	 * @param isJobSearchActive - A boolean flag indicating whether the job search is active.
	 * @returns {Promise<void>} - A Promise resolving to void.
	 */
	async updateJobSearchAvailability(employee: IEmployee, isJobSearchActive: boolean): Promise<void> {
		try {
			// Ensure the organization context is available before proceeding.
			if (!this.organization) {
				return;
			}

			// Destructure organization properties for clarity.
			const { id: organizationId, tenantId } = this.organization;

			// Update the job search status using the employeesService.
			await this._jobService.updateJobSearchStatus(employee.id, {
				isJobSearchActive,
				organizationId,
				tenantId
			});

			// Display a success toastr notification based on the job search status.
			const toastrMessageKey = isJobSearchActive
				? 'TOASTR.MESSAGE.EMPLOYEE_JOB_STATUS_ACTIVE'
				: 'TOASTR.MESSAGE.EMPLOYEE_JOB_STATUS_INACTIVE';

			const fullName = employee.fullName.trim() || 'Unknown Employee';
			this._toastrService.success(toastrMessageKey, { name: fullName });
		} catch (error) {
			// Display an error toastr notification in case of any exceptions.
			this._toastrService.danger(error);
		}
	}

	/**
	 * Applies translations to the Smart Table settings when the language changes.
	 * This method listens for the onLangChange event from the translateService.
	 */
	private _applyTranslationOnSmartTable(): void {
		// Subscribe to language changes using onLangChange
		this.translateService.onLangChange
			.pipe(
				// Trigger the loading of Smart Table settings when the language changes
				tap(() => this._loadSmartTableSettings()),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Handles the change of a tab.
	 *
	 * @param tab - The NbTabComponent representing the selected tab.
	 */
	onTabChange(tab: NbTabComponent) {}

	/**
	 * Handles the selection or deselection of an employee.
	 *
	 * @param param0 - Object containing selection information ({ isSelected, data }).
	 */
	onSelectEmployee({ isSelected, data }): void {
		// Update the disableButton flag based on whether an employee is selected
		this.disableButton = !isSelected;

		// Update the selectedEmployee based on the selection status
		this.selectedEmployee = isSelected ? data : null;
	}

	/**
	 * Edit employee.
	 *
	 * @param selectedItem - The employee to be edited.
	 */
	edit(selectedItem?: IEmployee): void {
		// If a specific employee is selected, update the selected employee state
		if (selectedItem) {
			this.onSelectEmployee({
				isSelected: true,
				data: selectedItem
			});
		}

		// Navigate to the employee edit page
		this._router.navigate(['/pages/employees/edit/', this.selectedEmployee.id]);
	}

	/**
	 * Navigates to the employee addition page and opens the add dialog.
	 *
	 * @param event - The pointer event that triggered this method.
	 * @returns A promise that resolves when the navigation is complete or exits early if there is no organization.
	 */
	addNew = async (event: MouseEvent): Promise<void> => {
		if (!this.organization) {
			return;
		}
		try {
			this._router.navigate(['/pages/employees/'], {
				queryParams: { openAddDialog: true }
			});
		} catch (error) {
			this._toastrService.error(error.message || error);
		}
	};

	ngOnDestroy(): void {
		this._pageTabRegistryService.deleteTabset(this.tabsetId); // Delete the dashboard tabset from the registry
	}
}

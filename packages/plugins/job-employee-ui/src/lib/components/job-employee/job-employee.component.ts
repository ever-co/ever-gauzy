import { AfterViewInit, Component, inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, combineLatest, merge, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Cell } from 'angular2-smart-table';
import { NgxPermissionsService } from 'ngx-permissions';
import { ID, IEmployee, IOrganization, LanguagesEnum, PermissionsEnum } from '@gauzy/contracts';
import { API_PREFIX, distinctUntilChange, isNotNullOrUndefined } from '@gauzy/ui-core/common';
import {
	PageDataTableRegistryService,
	EmployeesService,
	ServerDataSource,
	Store,
	ToastrService,
	PageTabsetPageId,
	PageTabRegistryService,
	PageDataTablePageId,
	JobSearchStoreService
} from '@gauzy/ui-core/core';
import { I18nService } from '@gauzy/ui-core/i18n';
import {
	EmployeeLinksComponent,
	IPaginationBase,
	NumberEditorComponent,
	EmployeeLinkEditorComponent,
	PaginationFilterBaseComponent,
	NonEditableNumberEditorComponent,
	JobSearchAvailabilityEditorComponent,
	ToggleSwitcherComponent
} from '@gauzy/ui-core/shared';

/**
 * Tab identifiers for the job employee page (Browse, Search, History).
 */
export enum JobSearchTabsEnum {
	BROWSE = 'BROWSE',
	SEARCH = 'SEARCH',
	HISTORY = 'HISTORY'
}

/**
 * Job Employee Component
 *
 * Displays and manages job employees: browse list with statistics (available/applied jobs,
 * billing rates, job search status), pagination, and integration with the page tab and data table registries.
 */
@UntilDestroy()
@Component({
	selector: 'ga-job-employees',
	templateUrl: './job-employee.component.html',
	styleUrls: ['./job-employee.component.scss'],
	providers: [CurrencyPipe],
	standalone: false
})
export class JobEmployeeComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit {
	private readonly _http = inject(HttpClient);
	private readonly _route = inject(ActivatedRoute);
	private readonly _router = inject(Router);
	private readonly _ngxPermissionsService = inject(NgxPermissionsService);
	private readonly _store = inject(Store);
	private readonly _employeesService = inject(EmployeesService);
	private readonly _jobSearchStoreService = inject(JobSearchStoreService);
	private readonly _toastrService = inject(ToastrService);
	private readonly _currencyPipe = inject(CurrencyPipe);
	private readonly _i18nService = inject(I18nService);
	private readonly _pageDataTableRegistryService = inject(PageDataTableRegistryService);
	private readonly _pageTabRegistryService = inject(PageTabRegistryService);

	public readonly jobSearchTabsEnum = JobSearchTabsEnum;
	public readonly employees$ = new Subject<boolean>();
	public readonly nbTab$ = new BehaviorSubject<JobSearchTabsEnum>(JobSearchTabsEnum.BROWSE);
	public loading = false;
	public settingsSmartTable: any;
	public smartTableSource: ServerDataSource;
	public organization: IOrganization | null = null;
	public selectedEmployeeId: ID | null = null;
	public selectedEmployee: IEmployee | null = null;
	public disableButton = true;

	public readonly tabsetId: PageTabsetPageId = this._route.snapshot.data['tabsetId'];
	public readonly dataTableId: PageDataTablePageId = this._route.snapshot.data['dataTableId'];

	@ViewChild('tableLayout', { static: true }) readonly tableLayout!: TemplateRef<unknown>;
	@ViewChild('comingSoon', { static: true }) readonly comingSoon!: TemplateRef<unknown>;

	constructor() {
		super(inject(TranslateService));
	}

	/** Initialize permissions, locale, page tabs/columns, smart table settings, and translation listener. */
	ngOnInit(): void {
		this._initializeUiPermissions();
		this._initializeUiLanguagesAndLocale();
		this._initializePageElements();
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
	}

	/** Subscribe to employees$, pagination$, and store (organization + employee) to load and refresh job employees. */
	ngAfterViewInit(): void {
		this.employees$
			.pipe(
				debounceTime(100),
				tap(() => this.getActiveJobEmployees()),
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

		combineLatest([this._store.selectedOrganization$, this._store.selectedEmployee$])
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployeeId = employee ? employee.id : null;
				}),
				tap(() => this.employees$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Initializes page elements by registering page tabs and data table columns
	 * with the tab and data table registry services.
	 */
	private _initializePageElements(): void {
		this.registerPageTabs(this._pageTabRegistryService);
		this.registerDataTableColumns(this._pageDataTableRegistryService);
	}

	/**
	 * Registers the Browse, Search, and History tabs for the job employee tabset.
	 *
	 * @param _pageTabRegistryService - The PageTabRegistryService to register the tabs with.
	 * @returns void
	 */
	private registerPageTabs(_pageTabRegistryService: PageTabRegistryService): void {
		_pageTabRegistryService.registerPageTab({
			tabsetId: this.tabsetId,
			tabId: 'browse',
			tabIcon: 'globe-2-outline',
			tabsetType: 'standard',
			tabTitle: (_i18n) => _i18n.getTranslation('JOB_EMPLOYEE.BROWSE'),
			order: 1,
			responsive: true,
			template: this.tableLayout
		});

		_pageTabRegistryService.registerPageTab({
			tabsetId: this.tabsetId,
			tabId: 'search',
			tabIcon: 'search-outline',
			tabsetType: 'standard',
			tabTitle: (_i18n) => _i18n.getTranslation('JOB_EMPLOYEE.SEARCH'),
			order: 2,
			responsive: true,
			template: this.comingSoon
		});

		_pageTabRegistryService.registerPageTab({
			tabsetId: this.tabsetId,
			tabId: 'history',
			tabIcon: 'clock-outline',
			tabsetType: 'standard',
			tabTitle: (_i18n) => _i18n.getTranslation('JOB_EMPLOYEE.HISTORY'),
			order: 3,
			responsive: true,
			template: this.comingSoon
		});
	}

	/**
	 * Registers data table columns (employee, available/applied jobs, billing rates, job search status).
	 * @param _pageDataTableRegistryService - The PageDataTableRegistryService to register the columns with.
	 * @returns void
	 */
	private registerDataTableColumns(_pageDataTableRegistryService: PageDataTableRegistryService): void {
		_pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: this.dataTableId,
			columnId: 'name',
			order: 0,
			title: () => this.getTranslation('JOB_EMPLOYEE.EMPLOYEE'),
			type: 'custom',
			width: '20%',
			isSortable: true,
			isEditable: false,
			renderComponent: EmployeeLinksComponent,
			valuePrepareFunction: (_: any, cell: Cell) => this.prepareEmployeeValue(_, cell),
			componentInitFunction: (instance: EmployeeLinksComponent, cell: Cell) => {
				instance.rowData = cell.getRow().getData();
				instance.value = cell.getValue();
			},
			editor: {
				type: 'custom',
				component: EmployeeLinkEditorComponent
			}
		});

		_pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: this.dataTableId,
			columnId: 'availableJobs',
			order: 1,
			title: () => this.getTranslation('JOB_EMPLOYEE.AVAILABLE_JOBS'),
			type: 'text',
			width: '10%',
			isSortable: false,
			isEditable: false,
			valuePrepareFunction: (rawValue: any) => (isNotNullOrUndefined(rawValue) ? rawValue : 0),
			editor: {
				type: 'custom',
				component: NonEditableNumberEditorComponent
			}
		});

		_pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: this.dataTableId,
			columnId: 'appliedJobs',
			order: 2,
			title: () => this.getTranslation('JOB_EMPLOYEE.APPLIED_JOBS'),
			type: 'text',
			width: '10%',
			isSortable: false,
			isEditable: false,
			valuePrepareFunction: (rawValue: any) => (isNotNullOrUndefined(rawValue) ? rawValue : 0),
			editor: {
				type: 'custom',
				component: NonEditableNumberEditorComponent
			}
		});

		_pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: this.dataTableId,
			columnId: 'billRateValue',
			order: 3,
			title: () => this.getTranslation('JOB_EMPLOYEE.BILLING_RATE'),
			type: 'text',
			width: '10%',
			isSortable: false,
			isEditable: true,
			editor: {
				type: 'custom',
				component: NumberEditorComponent
			},
			valuePrepareFunction: (rawValue: any, cell: Cell) => {
				const employee: IEmployee = cell.getRow().getData();
				return this._currencyPipe.transform(rawValue, employee?.billRateCurrency);
			}
		});

		_pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: this.dataTableId,
			columnId: 'minimumBillingRate',
			order: 4,
			title: () => this.getTranslation('JOB_EMPLOYEE.MINIMUM_BILLING_RATE'),
			type: 'text',
			width: '20%',
			isSortable: false,
			isEditable: true,
			editor: {
				type: 'custom',
				component: NumberEditorComponent
			},
			valuePrepareFunction: (value: number, cell: Cell) => {
				const employee: IEmployee = cell.getRow().getData();
				return this._currencyPipe.transform(value, employee?.billRateCurrency);
			}
		});

		_pageDataTableRegistryService.registerPageDataTableColumn({
			dataTableId: this.dataTableId,
			columnId: 'isJobSearchActive',
			order: 5,
			title: () => this.getTranslation('JOB_EMPLOYEE.JOB_SEARCH_STATUS'),
			type: 'custom',
			width: '20%',
			isSortable: false,
			isEditable: true,
			renderComponent: ToggleSwitcherComponent,
			componentInitFunction: (instance: ToggleSwitcherComponent, cell: Cell) => {
				const employee: IEmployee = cell.getRow().getData();
				instance.label = false;
				instance.value = employee.isJobSearchActive;

				/** Subscribe to the onSwitched event and update the job search availability. */
				instance.onSwitched.pipe(untilDestroyed(instance)).subscribe((toggle: boolean) => {
					this._jobSearchStoreService.updateJobSearchAvailability(this.organization, employee, toggle);
				});
			},
			editor: {
				type: 'custom',
				component: JobSearchAvailabilityEditorComponent
			}
		});
	}

	/**
	 * Loads the current user's permissions into NgxPermissionsService.
	 * @returns void
	 */
	private _initializeUiPermissions(): void {
		const permissions = this._store.userRolePermissions.map(({ permission }) => permission);
		this._ngxPermissionsService.flushPermissions();
		this._ngxPermissionsService.loadPermissions(permissions);
	}

	/**
	 * Subscribes to preferred language and applies it via TranslateService.
	 * @returns void
	 */
	private _initializeUiLanguagesAndLocale(): void {
		const preferredLanguage$ = merge(this._store.preferredLanguage$, this._i18nService.preferredLanguage$).pipe(
			distinctUntilChange(),
			filter((lang: string | LanguagesEnum) => !!lang),
			tap((lang: string | LanguagesEnum) => {
				this.translateService.use(lang);
			}),
			untilDestroyed(this)
		);

		preferredLanguage$.subscribe();
	}

	/**
	 * Builds and assigns the Smart Table ServerDataSource for job employee statistics
	 * (organization/tenant filter, optional employee filter, permission-based restrictions).
	 */
	setSmartTableSource(): void {
		if (!this.organization) {
			return;
		}

		this.loading = true;

		try {
			const { id: organizationId, tenantId } = this.organization;

			const whereClause = {
				tenantId,
				organizationId,
				isActive: true,
				isArchived: false,
				...(this.selectedEmployeeId ? { id: this.selectedEmployeeId } : {}),
				...(this.filters.where ? this.filters.where : {})
			};

			if (!this._store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
				const employeeId = this._store.user?.employee?.id;
				whereClause.id = employeeId;
			}

			this.smartTableSource = new ServerDataSource(this._http, {
				endPoint: `${API_PREFIX}/employee-job/statistics`,
				relations: ['user'],
				where: { ...whereClause },
				finalize: () => {
					this.setPagination({
						...this.getPagination(),
						totalItems: this.smartTableSource.count()
					});
				}
			});
		} catch (error) {
			this._toastrService.danger(error);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Loads active job employees into the smart table and applies current pagination.
	 * @returns void
	 */
	async getActiveJobEmployees(): Promise<void> {
		try {
			if (!this.organization) {
				return;
			}

			this.setSmartTableSource();

			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
		} catch (error) {
			this._toastrService.danger(error);
		}
	}

	/**
	 * Builds smart table settings (pager, columns from registry, edit actions, no-data message).
	 * @returns void
	 */
	private _loadSmartTableSettings(): void {
		const pagination: IPaginationBase = this.getPagination();

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
	 * Prepares the employee cell value (name, imageUrl, id) for the employee links column.
	 * @param _ - The event object.
	 * @param cell - The cell object.
	 * @returns The employee cell value.
	 */
	private prepareEmployeeValue(_: any, cell: Cell): any {
		const employee: IEmployee | undefined = cell.getRow().getData();

		if (employee) {
			const { user, id } = employee;
			return {
				name: user?.name ?? null,
				imageUrl: user?.imageUrl ?? null,
				id: id ?? null
			};
		}

		return { name: null, imageUrl: null, id: null };
	}

	/**
	 * Handles smart table edit confirm: updates employee bill rate and minimum billing rate, then refreshes the list.
	 * @param event - The event object.
	 * @returns void
	 */
	async onEditConfirm(event: any): Promise<void> {
		try {
			if (!this.organization) {
				return;
			}

			const { id: organizationId, tenantId } = this.organization;
			const employeeId = event.data?.id;
			const { billRateValue, minimumBillingRate } = event.newData ?? {};

			await this._employeesService.updateProfile(employeeId, {
				minimumBillingRate: +minimumBillingRate,
				billRateValue: +billRateValue,
				tenantId,
				organizationId
			});

			this.employees$.next(true);
			await event.confirm.resolve(event.newData);
		} catch (error) {
			console.error('Error while updating employee rates', error);
			await event.confirm.reject();
		}
	}

	/**
	 * Handles smart table edit cancel: refreshes the table to revert in-place changes.
	 * @param event - The event object.
	 * @returns void
	 */
	onEditCancel(event: any): void {
		this.smartTableSource.refresh();
	}

	/** Re-applies smart table settings when the application language changes. */
	private _applyTranslationOnSmartTable(): void {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Updates selected employee and edit button state when a row is selected or deselected.
	 * @param isSelected - Whether the employee is selected.
	 * @param data - The employee data.
	 * @returns void
	 */
	onSelectEmployee({ isSelected, data }: { isSelected: boolean; data: IEmployee }): void {
		this.disableButton = !isSelected;
		this.selectedEmployee = isSelected ? data : null;
	}

	/**
	 * Navigates to the employee edit page for the selected or given employee.
	 * @param selectedItem - The employee to edit.
	 * @returns void
	 */
	edit(selectedItem?: IEmployee): void {
		if (selectedItem) {
			this.onSelectEmployee({
				isSelected: true,
				data: selectedItem
			});
		}
		const employeeId = this.selectedEmployee?.id;
		if (employeeId) {
			this._router.navigate(['/pages/employees/edit/', employeeId]);
		}
	}

	/**
	 * Navigates to the employees page with the add-dialog query param to open the add-employee dialog.
	 * @param event - The mouse event that triggered the navigation.
	 * @returns void
	 */
	async addNew(event?: MouseEvent): Promise<void> {
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
	}
}

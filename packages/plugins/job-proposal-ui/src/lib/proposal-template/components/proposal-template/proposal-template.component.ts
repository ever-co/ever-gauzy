import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NbDialogService, NbTabComponent } from '@nebular/theme';
import { combineLatest, Subject, firstValueFrom, BehaviorSubject, merge } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Cell } from 'angular2-smart-table';
import { NgxPermissionsService } from 'ngx-permissions';
import {
	IEmployee,
	IEmployeeProposalTemplate,
	IEmployeeProposalTemplateMakeDefaultInput,
	IOrganization,
	ISelectedEmployee,
	LanguagesEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { API_PREFIX, distinctUntilChange } from '@gauzy/ui-core/common';
import {
	ErrorHandlingService,
	ProposalTemplateService,
	ServerDataSource,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { I18nService } from '@gauzy/ui-core/i18n';
import {
	DeleteConfirmationComponent,
	EmployeeLinksComponent,
	IPaginationBase,
	Nl2BrPipe,
	PaginationFilterBaseComponent,
	TruncatePipe
} from '@gauzy/ui-core/shared';
import { AddEditProposalTemplateComponent } from '../add-edit-proposal-template/add-edit-proposal-template.component';

export enum ProposalTemplateTabsEnum {
	ACTIONS = 'ACTIONS',
	SEARCH = 'SEARCH'
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-proposal-template',
	templateUrl: './proposal-template.component.html',
	styleUrls: ['./proposal-template.component.scss']
})
export class ProposalTemplateComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	public smartTableSettings: any;
	public disableButton: boolean = true;
	public loading: boolean = false;
	public smartTableSource: ServerDataSource;
	public selectedEmployee: ISelectedEmployee;
	public selectedItem: any;
	public proposalTemplateTabsEnum = ProposalTemplateTabsEnum;
	public templates$: Subject<any> = new Subject();
	public organization: IOrganization;
	public nbTab$: Subject<string> = new BehaviorSubject(ProposalTemplateTabsEnum.ACTIONS);

	constructor(
		translateService: TranslateService,
		private readonly _store: Store,
		private readonly _toastrService: ToastrService,
		private readonly _proposalTemplateService: ProposalTemplateService,
		private readonly _dialogService: NbDialogService,
		private readonly _nl2BrPipe: Nl2BrPipe,
		private readonly _truncatePipe: TruncatePipe,
		private readonly _http: HttpClient,
		private readonly _route: ActivatedRoute,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _ngxPermissionsService: NgxPermissionsService,
		private readonly _i18nService: I18nService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Apply translation on smart table
		this._applyTranslationOnSmartTable();
		// Load smart table settings
		this._loadSmartTableSettings();
		// Initialize UI permissions
		this.initializeUiPermissions();
		// Initialize UI languages and Update Locale
		this.initializeUiLanguagesAndLocale();

		// Subscribe to changes in the templates$ observable stream
		this.templates$
			.pipe(
				// Debounce the observable to wait for 100 milliseconds of inactivity
				debounceTime(100),
				// Perform the 'clearItem' action when the observable emits a value
				tap(() => this.clearItem()),
				// Perform the 'getProposalTemplates' action when the observable emits a value
				tap(() => this.getProposalTemplates()),
				// Unsubscribe from the observable when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to changes in the nbTab$ observable stream
		this.nbTab$
			.pipe(
				// Debounce the observable to wait for 100 milliseconds of inactivity
				debounceTime(100),
				// Ensure that only distinct values are processed
				distinctUntilChange(),
				// Trigger the next value in the templates$ observable
				tap(() => this.templates$.next(true)),
				// Unsubscribe from the observable when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to changes in the pagination$ observable stream
		this.pagination$
			.pipe(
				// Debounce the observable to wait for 100 milliseconds of inactivity
				debounceTime(100),
				// Ensure that only distinct values are processed
				distinctUntilChange(),
				// Trigger the next value in the templates$ observable
				tap(() => this.templates$.next(true)),
				// Unsubscribe from the observable when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this._store.selectedOrganization$;
		const storeEmployee$ = this._store.selectedEmployee$;
		// Combine the latest values from storeOrganization$ and storeEmployee$ observables
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				// Debounce the observable to wait for 300 milliseconds of inactivity
				debounceTime(300),
				// Ensure that only distinct values are processed
				distinctUntilChange(),
				// Filter out values where organization is not truthy
				filter(([organization]) => !!organization),
				// Perform actions based on the emitted values
				tap(([organization, employee]) => {
					// Update the organization and selectedEmployee properties
					this.organization = organization;
					this.selectedEmployee = employee && employee.id ? employee : null;
				}),
				// Trigger a refresh of pagination
				tap(() => this.refreshPagination()),
				// Trigger the next value in the templates$ observable
				tap(() => this.templates$.next(true)),
				// Unsubscribe from the observable when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		this._route.queryParamMap
			.pipe(
				// Filter out falsy values and check if the 'openAddDialog' query parameter is 'true'
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				// Debounce the observable to wait for 1000 milliseconds of inactivity
				debounceTime(1000),
				// Perform the 'createProposalTemplate' action when the observable emits a value
				tap(() => this.createProposalTemplate()),
				// Unsubscribe from the observable when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		// Check if the user is logged in and does not have the specified permission
		if (this._store.user && !this._store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			// Remove the 'employeeId' column from the smartTableSettings
			delete this.smartTableSettings['columns']['employeeId'];

			// Create a new object with the updated smartTableSettings
			this.smartTableSettings = Object.assign({}, this.smartTableSettings);
		}
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
			filter((lang: LanguagesEnum) => !!lang),
			tap((lang: string | LanguagesEnum) => {
				this.translateService.use(lang);
			}),
			untilDestroyed(this)
		);

		// Subscribe to initiate the stream
		preferredLanguage$.subscribe();
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		// Check if 'organization' is not defined
		if (!this.organization) {
			return; // If not defined, exit the function
		}

		// Set loading to true while data is being loaded
		this.loading = true;

		// Destructure 'organizationId' from the 'organization' object
		const { id: organizationId, tenantId } = this.organization;

		// Create a new instance of ServerDataSource with specified configuration
		this.smartTableSource = new ServerDataSource(this._http, {
			// Specify the API endpoint for data retrieval
			endPoint: `${API_PREFIX}/employee-proposal-template/pagination`,

			// Define relations to be included in the data retrieval
			relations: ['employee', 'employee.user'],

			// Define the filtering criteria using organizationId and tenantId
			where: {
				organizationId,
				tenantId,
				...(this.selectedEmployee ? { employeeId: this.selectedEmployee.id } : {}),
				...(this.filters.where ? this.filters.where : {})
			},

			// Finalize function called after data retrieval is complete
			finalize: () => {
				// Set pagination information based on the smart table source
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});

				// Set loading to false as data loading is complete
				this.loading = false;
			}
		});
	}

	/**
	 * Retrieves and sets up proposal templates based on the current organization.
	 * @returns {Promise<void>}
	 */
	async getProposalTemplates(): Promise<void> {
		// Check if 'organization' is not defined
		if (!this.organization) {
			return; // If not defined, exit the function
		}

		try {
			// Set up the smart table source
			this.setSmartTableSource();

			// Get current pagination settings
			const { activePage, itemsPerPage } = this.getPagination();

			// Set paging for the smart table source
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
		} catch (error) {
			console.log('Error while retrieving proposal templates', error);
			// Handle errors by displaying a danger toastr message
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Selects an item and updates properties based on the selection state.
	 * @param isSelected - A boolean indicating whether the item is selected.
	 * @param data - The data associated with the selected item.
	 */
	selectProposalTemplate({ isSelected, data }) {
		// Update the disableButton property based on the isSelected value
		this.disableButton = !isSelected;

		// Update the selectedItem property based on the isSelected value
		this.selectedItem = isSelected ? data : null;
	}

	/**
	 * Load and configure the settings for the Smart Table component.
	 * This method is typically called when the language changes.
	 */
	private _loadSmartTableSettings(): void {
		// Get the current pagination settings
		const pagination: IPaginationBase = this.getPagination();

		// Configure Smart Table settings
		this.smartTableSettings = {
			actions: false,
			editable: true,
			hideSubHeader: true,
			selectedRowIndex: -1,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.PROPOSAL_TEMPLATE'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				employee: {
					title: this.getTranslation('PROPOSAL_TEMPLATE.EMPLOYEE'),
					isFilterable: false,
					width: '20%',
					type: 'custom',
					isSortable: false,
					renderComponent: EmployeeLinksComponent,
					valuePrepareFunction: (value: IEmployee) => ({
						id: value?.id,
						name: value?.user?.name,
						fullName: value?.fullName,
						imageUrl: value?.user?.imageUrl
					}),
					componentInitFunction: (instance: EmployeeLinksComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				name: {
					title: this.getTranslation('PROPOSAL_TEMPLATE.NAME'),
					type: 'text',
					width: '30%',
					isFilterable: false,
					isSortable: false,
					valuePrepareFunction: (value: string) => value.slice(0, 150)
				},
				content: {
					title: this.getTranslation('PROPOSAL_TEMPLATE.DESCRIPTION'),
					type: 'html',
					width: '40%',
					isFilterable: false,
					isSortable: false,
					valuePrepareFunction: (value: string) => {
						return value ? this._truncatePipe.transform(this._nl2BrPipe.transform(value), 500) : '';
					}
				},
				isDefault: {
					title: this.getTranslation('PROPOSAL_TEMPLATE.IS_DEFAULT'),
					type: 'text',
					width: '10%',
					isFilterable: false,
					isSortable: false,
					valuePrepareFunction: (value: boolean) => {
						return value
							? this.getTranslation('PROPOSAL_TEMPLATE.YES')
							: this.getTranslation('PROPOSAL_TEMPLATE.NO');
					}
				}
			}
		};
	}

	/**
	 * Asynchronously opens a dialog to create a new proposal template.
	 * Once the dialog is closed, updates the templates$ observable.
	 */
	async createProposalTemplate(): Promise<void> {
		// Open a dialog for adding/editing a proposal template
		const dialog = this._dialogService.open(AddEditProposalTemplateComponent, {
			context: { selectedEmployee: this.selectedEmployee }
		});

		// Wait for the dialog to close and get the result
		const data = await firstValueFrom(dialog.onClose);

		// If data is received from the dialog, update the templates$ observable
		if (data) {
			this.templates$.next(true);
		}
	}

	/**
	 * Asynchronously opens a dialog to edit an existing proposal template.
	 * Once the dialog is closed, updates the templates$ observable.
	 */
	async editProposalTemplate(): Promise<void> {
		// Open a dialog for adding/editing a proposal template
		const dialog = this._dialogService.open(AddEditProposalTemplateComponent, {
			context: {
				proposalTemplate: this.selectedItem,
				selectedEmployee: this.selectedEmployee
			}
		});

		// Wait for the dialog to close and get the result
		const data = await firstValueFrom(dialog.onClose);

		// If data is received from the dialog (indicating a successful operation), update the templates$ observable
		if (data) {
			this.templates$.next(true);
		}
	}

	/**
	 * Deletes the selected proposal template.
	 */
	deleteProposalTemplate(selectedItem?: IEmployeeProposalTemplate): void {
		// If a proposal template item is selected, mark it as selected
		if (selectedItem) {
			this.selectProposalTemplate({
				isSelected: true,
				data: selectedItem
			});
		}

		// Open the dialog for user confirmation
		const dialogRef = this._dialogService.open(DeleteConfirmationComponent, {
			context: { recordType: 'Proposal' }
		});

		// Wait for the dialog to close and get the result
		dialogRef.onClose.pipe(untilDestroyed(this)).subscribe(async (dialogResult) => {
			try {
				// If there is a result and a proposal is selected
				if (dialogResult) {
					if (!this.selectedItem) {
						return;
					}

					const { id: proposalTemplateId, name } = this.selectedItem;

					// Delete the proposal template for specific employee
					await this._proposalTemplateService.delete(proposalTemplateId);

					// Display a success message using the toastrService
					this._toastrService.success('PROPOSAL_TEMPLATE.PROPOSAL_DELETE_MESSAGE', { name });
				}
			} catch (error) {
				// Handle errors during the process
				this._errorHandlingService.handleError(error);
			} finally {
				// Update the templates$ observable, regardless of success or failure
				this.templates$.next(true);
			}
		});
	}

	/**
	 * Updates the default status of the selected proposal template.
	 */
	async makeDefaultTemplate(input: IEmployeeProposalTemplateMakeDefaultInput): Promise<void> {
		try {
			if (!this.selectedItem) {
				return;
			}

			const { id: proposalTemplateId, organizationId, tenantId } = this.selectedItem;

			// Call the makeDefault method of the proposalTemplateService to update the default status
			const result = await this._proposalTemplateService.makeDefault(proposalTemplateId, {
				isDefault: input.isDefault,
				organizationId,
				tenantId
			});

			// Determine the success message based on whether the template is set as default or not
			const successMessage = result.isDefault
				? 'PROPOSAL_TEMPLATE.PROPOSAL_MAKE_DEFAULT_MESSAGE'
				: 'PROPOSAL_TEMPLATE.PROPOSAL_REMOVE_DEFAULT_MESSAGE';

			// Display a success message using the toastrService
			this._toastrService.success(successMessage, { name: this.selectedItem.name });
		} catch (error) {
			// Handle errors during the process
			this._errorHandlingService.handleError(error);
		} finally {
			// Update the templates$ observable, regardless of success or failure
			this.templates$.next(true);
		}
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectProposalTemplate({ isSelected: false, data: null });
	}

	/**
	 * Applies translations to the smart table when the language changes.
	 * Uses the translateService to listen for language changes and loads smart table settings accordingly.
	 */
	private _applyTranslationOnSmartTable(): void {
		// Subscribe to the onLangChange observable provided by translateService
		this.translateService.onLangChange
			.pipe(
				// Tap into the observable to execute a side effect (loading smart table settings)
				tap(() => this._loadSmartTableSettings()),
				// Use the untilDestroyed operator to automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			// Subscribe to the observable
			.subscribe();
	}

	/**
	 * Called when a tab changes.
	 * Updates the nbTab$ observable with the ID of the selected tab.
	 * @param tab - The selected tab.
	 */
	onTabChange(tab: NbTabComponent): void {
		// Update the nbTab$ observable with the ID of the selected tab
		this.nbTab$.next(tab.tabId);
	}

	ngOnDestroy(): void {}
}

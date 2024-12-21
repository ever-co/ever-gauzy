import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ComponentLayoutStyleEnum, IOrganization, ITimeOffPolicy, PermissionsEnum } from '@gauzy/contracts';
import { debounceTime, filter, first, tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { Cell } from 'angular2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ErrorHandlingService, ServerDataSource, Store, TimeOffService, ToastrService } from '@gauzy/ui-core/core';
import { API_PREFIX, ComponentEnum, distinctUntilChange } from '@gauzy/ui-core/common';
import {
	DeleteConfirmationComponent,
	EmployeeWithLinksComponent,
	IPaginationBase,
	PaginationFilterBaseComponent,
	TimeOffSettingsMutationComponent
} from '@gauzy/ui-core/shared';
import { PaidIcon, RequestApprovalIcon } from '../table-components';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-time-off-policy-list',
    templateUrl: './time-off-settings.component.html',
    styleUrls: ['./time-off-settings.component.scss'],
    standalone: false
})
export class TimeOffSettingsComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	public smartTableSettings: object;
	public selectedPolicy: ITimeOffPolicy;
	public smartTableSource: ServerDataSource;
	public organization: IOrganization;
	public timeOffPolicies: ITimeOffPolicy[] = [];
	public loading: boolean = false;
	public disableButton: boolean = true;
	public PermissionsEnum = PermissionsEnum;
	public viewComponentName: ComponentEnum;
	public dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	public componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	private _refresh$: Subject<any> = new Subject();
	public timeOffPolicies$: Subject<any> = this.subject$;

	private get _isGridLayout(): boolean {
		return this.componentLayoutStyleEnum.CARDS_GRID === this.dataLayoutStyle;
	}

	constructor(
		readonly translateService: TranslateService,
		private readonly _dialogService: NbDialogService,
		private readonly _httpClient: HttpClient,
		private readonly _toastrService: ToastrService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _timeOffService: TimeOffService,
		private readonly _store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();

		this.timeOffPolicies$
			.pipe(
				debounceTime(300),
				tap(() => this._clearItem()),
				tap(() => this._getTimeOffSettings()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.timeOffPolicies$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this._store.selectedOrganization$;
		storeOrganization$
			.pipe(
				debounceTime(100),
				filter((organization) => !!organization),
				distinctUntilChange(),
				tap((organization) => (this.organization = organization)),
				tap(() => this._refresh$.next(true)),
				tap(() => this.timeOffPolicies$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this._isGridLayout),
				tap(() => this.refreshPagination()),
				tap(() => (this.timeOffPolicies = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.TIME_OFF_SETTINGS;
		this._store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.timeOffPolicies = [])),
				tap(() => this.timeOffPolicies$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Load settings for smart table
	 */
	private _loadSmartTableSettings() {
		// Get pagination settings
		const pagination: IPaginationBase = this.getPagination();

		// Set up smart table settings
		this.smartTableSettings = {
			actions: false,
			editable: true,
			selectedRowIndex: -1,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.TIME_OFF_POLICY'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : this.minItemPerPage
			},
			columns: {
				name: {
					title: this.getTranslation('TIME_OFF_PAGE.POLICY.NAME'),
					type: 'string',
					isFilterable: true
				},
				employees: {
					title: this.getTranslation('SM_TABLE.EMPLOYEES'),
					type: 'custom',
					isFilterable: false,
					renderComponent: EmployeeWithLinksComponent,
					componentInitFunction: (instance: EmployeeWithLinksComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getRawValue();
					}
				},
				requiresApproval: {
					title: this.getTranslation('TIME_OFF_PAGE.POLICY.REQUIRES_APPROVAL'),
					type: 'custom',
					width: '20%',
					isFilterable: false,
					renderComponent: RequestApprovalIcon,
					componentInitFunction: (instance: RequestApprovalIcon, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				paid: {
					title: this.getTranslation('TIME_OFF_PAGE.POLICY.PAID'),
					type: 'custom',
					width: '20%',
					isFilterable: false,
					renderComponent: PaidIcon,
					componentInitFunction: (instance: PaidIcon, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				}
			}
		};
	}

	/**
	 * Opens a dialog for adding a new time-off policy.
	 * After the dialog is closed, it checks the returned policy and proceeds to add it if available.
	 */
	openAddPolicyDialog(): void {
		// Open the add policy dialog
		this._dialogService
			.open(TimeOffSettingsMutationComponent)
			.onClose.pipe(
				// Filter out null or undefined policies
				filter((policy: ITimeOffPolicy) => !!policy),
				// When the dialog is closed, add the policy
				tap((policy: ITimeOffPolicy) => this.addPolicy(policy)),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Adds a new time-off policy.
	 * If a valid policy is provided, it adds the policy using the timeOffService.
	 * @param policy - The policy to be added.
	 */
	addPolicy(policy: ITimeOffPolicy): void {
		// Check if a valid policy is provided
		if (policy) {
			// Add the policy using timeOffService
			this._timeOffService
				.createPolicy(policy)
				.pipe(
					// Take the first emitted value and automatically unsubscribe when the component is destroyed
					first(),
					untilDestroyed(this)
				)
				.subscribe({
					next: () => {
						// Display success toast with the added policy's name
						this._toastrService.success('NOTES.POLICY.ADD_POLICY', { name: policy.name });

						// Trigger refresh for relevant observables
						this._refresh$.next(true);
						this.timeOffPolicies$.next(true);
					},
					error: () => {
						// Display a danger toast in case of an error during policy addition
						this._toastrService.danger('NOTES.POLICY.SAVE_ERROR');
					}
				});
		}
	}

	/**
	 * Opens a dialog for editing a time-off policy.
	 * If a specific policy is provided, it selects the policy.
	 * After the dialog is closed, it checks the returned policy and proceeds to update it if available.
	 * @param selectedItem - The policy to be selected initially.
	 */
	async openEditPolicyDialog(selectedItem?: ITimeOffPolicy): Promise<void> {
		// If a specific policy is provided, select the policy
		if (selectedItem) {
			this.selectTimeOffPolicy({
				isSelected: true,
				data: selectedItem
			});
		}

		// Open the edit policy dialog with the selected policy as context
		this._dialogService
			.open(TimeOffSettingsMutationComponent, {
				context: {
					policy: this.selectedPolicy
				}
			})
			.onClose.pipe(
				// Filter out null or undefined policies
				filter((policy: ITimeOffPolicy) => !!policy),
				// When the dialog is closed, edit/update the policy
				tap((policy: ITimeOffPolicy) => this.editPolicy(policy)),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Updates the selected time-off policy with the provided changes.
	 * Handles success and error cases and triggers refreshes for relevant observables.
	 * @param policy - The updated policy data.
	 */
	editPolicy(policy: ITimeOffPolicy): void {
		// Extract the ID of the selected policy
		const selectedPolicyId = this.selectedPolicy.id;

		// Update the policy using timeOffService
		this._timeOffService
			.updatePolicy(selectedPolicyId, policy)
			.pipe(
				// Take the first emitted value and automatically unsubscribe when the component is destroyed
				first(),
				untilDestroyed(this)
			)
			.subscribe({
				next: () => {
					// Display success toast with the edited policy's name
					this._toastrService.success('NOTES.POLICY.EDIT_POLICY', {
						name: policy.name
					});

					// Trigger refresh for relevant observables
					this._refresh$.next(true);
					this.timeOffPolicies$.next(true);
				},
				error: (error) => this._errorHandlingService.handleError(error)
			});
	}

	/**
	 * Opens a confirmation dialog for deleting a time-off policy.
	 * If a specific policy is provided, it selects the policy.
	 * After the dialog is closed, it checks the result and proceeds to delete the policy if confirmed.
	 */
	openDeletePolicyDialog(selectedItem?: ITimeOffPolicy): void {
		// If a specific policy is provided, select the policy
		if (selectedItem) {
			this.selectTimeOffPolicy({
				isSelected: true,
				data: selectedItem
			});
		}

		// Open the delete confirmation dialog
		this._dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: this.getTranslation('TIME_OFF_PAGE.POLICY.POLICY')
				}
			})
			.onClose.pipe(
				// Filter out null or undefined results
				filter((result) => !!result),
				// When the dialog is closed, delete the policy
				tap(() => this.deletePolicy()),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Deletes the selected time-off policy.
	 * If no policy is selected, the method returns early.
	 * Handles success and error cases and triggers refreshes for relevant observables.
	 */
	deletePolicy(): void {
		// Check if a policy is selected
		if (!this.selectedPolicy) {
			return;
		}

		// Delete the policy using timeOffService
		this._timeOffService
			.deletePolicy(this.selectedPolicy.id)
			.pipe(
				// Take the first emitted value and automatically unsubscribe when the component is destroyed
				first(),
				untilDestroyed(this)
			)
			.subscribe({
				next: () => {
					// Display success toast with the deleted policy's name
					this._toastrService.success('NOTES.POLICY.DELETE_POLICY', {
						name: this.selectedPolicy.name
					});

					// Trigger refresh for relevant observables
					this._refresh$.next(true);
					this.timeOffPolicies$.next(true);
				},
				error: (error) => this._errorHandlingService.handleError(error)
			});
	}

	/**
	 * Handles the selection of a time-off policy.
	 * @param isSelected - Indicates whether the policy is selected.
	 * @param data - The selected policy data.
	 */
	selectTimeOffPolicy({ isSelected, data }): void {
		this.disableButton = !isSelected;
		this.selectedPolicy = isSelected ? data : null;
	}

	/**
	 * Sets up the Smart Table data source for time-off policies.
	 * If the organization is not available, the method returns early.
	 * Handles errors and loading state appropriately.
	 */
	setSmartTableSource(): void {
		// Check if the organization is available
		if (!this.organization) {
			return;
		}

		try {
			// Set loading state to true while fetching data
			this.loading = true;

			// Destructure organization properties for clarity
			const { id: organizationId, tenantId } = this.organization;

			// Create a new ServerDataSource for Smart Table
			this.smartTableSource = new ServerDataSource(this._httpClient, {
				endPoint: `${API_PREFIX}/time-off-policy/pagination`,
				relations: ['employees', 'employees.user'],
				where: {
					organizationId,
					tenantId,
					...(this.filters.where ? this.filters.where : {})
				},
				finalize: () => {
					// Add data to timeOffPolicies array if in grid layout
					if (this._isGridLayout) {
						this.timeOffPolicies.push(...this.smartTableSource.getData());
					}

					// Update pagination based on the count of items in the source
					this.setPagination({
						...this.getPagination(),
						totalItems: this.smartTableSource.count()
					});

					// Set loading state to false once data fetching is complete
					this.loading = false;
				}
			});
		} catch (error) {
			// Handle errors and display a danger toast with the error message
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Retrieves and sets up time-off policies.
	 * If the organization is not available, the method returns early.
	 * Handles errors and loading state appropriately.
	 */
	private _getTimeOffSettings(): void {
		// Check if the organization is available
		if (!this.organization) {
			return;
		}

		try {
			// Set up the Smart Table source
			this.setSmartTableSource();

			// Get pagination settings
			const { activePage, itemsPerPage } = this.getPagination();

			// Set paging for the Smart Table source
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			// Load additional data for grid layout, if active
			if (this._isGridLayout) {
				this._loadGridLayoutData();
			}
		} catch (error) {
			// Handle errors and display a danger toast with the error message
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Asynchronously loads data for the grid layout using the Smart Table source.
	 * Handles errors and displays a danger toast if an error occurs.
	 */
	private async _loadGridLayoutData(): Promise<void> {
		try {
			// Use await to asynchronously load data using the Smart Table source
			await this.smartTableSource.getElements();
		} catch (error) {
			// Handle errors and display a danger toast with the error message
			this._errorHandlingService.handleError(error);
		}
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
	private _clearItem() {
		this.selectTimeOffPolicy({
			isSelected: false,
			data: null
		});
	}

	ngOnDestroy() {}
}

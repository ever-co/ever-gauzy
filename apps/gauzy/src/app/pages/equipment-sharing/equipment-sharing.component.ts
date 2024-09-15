import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import {
	IEquipmentSharing,
	ComponentLayoutStyleEnum,
	ISelectedEquipmentSharing,
	PermissionsEnum,
	RequestApprovalStatusTypesEnum,
	IOrganization,
	EquipmentSharingStatusEnum
} from '@gauzy/contracts';
import { Cell } from 'angular2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { combineLatest, Subject, firstValueFrom } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	EquipmentSharingService,
	ErrorHandlingService,
	ServerDataSource,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { API_PREFIX, ComponentEnum, distinctUntilChange } from '@gauzy/ui-core/common';
import {
	DateViewComponent,
	DeleteConfirmationComponent,
	EquipmentSharingMutationComponent,
	IPaginationBase,
	PaginationFilterBaseComponent,
	StatusBadgeComponent
} from '@gauzy/ui-core/shared';
import { EquipmentSharingPolicyTableComponent } from './table-components';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './equipment-sharing.component.html',
	styleUrls: ['./equipment-sharing.component.scss']
})
export class EquipmentSharingComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	loading: boolean = false;
	disableButton: boolean = true;

	settingsSmartTable: object;
	smartTableSource: ServerDataSource;
	selectedEquipmentSharing: IEquipmentSharing;
	equipments: IEquipmentSharing[] = [];

	PermissionsEnum = PermissionsEnum;
	RequestApprovalStatusTypesEnum = RequestApprovalStatusTypesEnum;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;

	equipmentSharing$: Subject<boolean> = this.subject$;
	public organization: IOrganization;
	public selectedEmployeeId: string;
	private _refresh$: Subject<any> = new Subject();

	constructor(
		public readonly translateService: TranslateService,
		private readonly equipmentSharingService: EquipmentSharingService,
		private readonly dialogService: NbDialogService,
		private readonly http: HttpClient,
		private readonly toastrService: ToastrService,
		private readonly errorHandlingService: ErrorHandlingService,
		private readonly store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
	}

	ngAfterViewInit(): void {
		this.equipmentSharing$
			.pipe(
				debounceTime(100),
				tap(() => this.clearItem()),
				tap(() => this.getEquipmentSharings()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeUser$ = this.store.user$;
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeUser$, storeOrganization$, storeEmployee$])
			.pipe(
				debounceTime(300),
				filter(([user, organization]) => !!user && !!organization),
				distinctUntilChange(),
				tap(([user, organization, employee]) => {
					this.organization = organization;
					this.selectedEmployeeId = user.employee ? user.employee.id : employee ? employee.id : null;
				}),
				tap(() => this._refresh$.next(true)),
				tap(() => this.equipmentSharing$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();

		this.pagination$
			.pipe(
				distinctUntilChange(),
				tap(() => this.equipmentSharing$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();

		this._refresh$
			.pipe(
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => (this.equipments = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy() {}

	setView() {
		this.viewComponentName = ComponentEnum.EQUIPMENT_SHARING;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.equipments = [])),
				tap(() => this.equipmentSharing$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			selectedRowIndex: -1,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.EQUIPMENT_SHARING'),
			columns: {
				name: {
					title: this.getTranslation('EQUIPMENT_SHARING_PAGE.EQUIPMENT_NAME'),
					type: 'string'
				},
				equipmentSharingPolicy: {
					title: this.getTranslation('EQUIPMENT_SHARING_PAGE.EQUIPMENT_SHARING_POLICY'),
					type: 'custom',
					isFilterable: false,
					renderComponent: EquipmentSharingPolicyTableComponent,
					componentInitFunction: (instance: EquipmentSharingPolicyTableComponent, cell: Cell) => {
						instance.value = cell.getRawValue();
					}
				},
				shareRequestDay: {
					title: this.getTranslation('EQUIPMENT_SHARING_PAGE.SHARE_REQUEST_DATE'),
					type: 'custom',
					isFilterable: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				shareStartDay: {
					title: this.getTranslation('EQUIPMENT_SHARING_PAGE.SHARE_START_DATE'),
					type: 'custom',
					isFilterable: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				shareEndDay: {
					title: this.getTranslation('EQUIPMENT_SHARING_PAGE.SHARE_END_DATE'),
					type: 'custom',
					isFilterable: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				createdByName: {
					title: this.getTranslation('EQUIPMENT_SHARING_PAGE.CREATED_BY'),
					type: 'string'
				},
				sharingStatus: {
					title: this.getTranslation('EQUIPMENT_SHARING_PAGE.STATUS'),
					type: 'custom',
					width: '5%',
					isFilterable: false,
					renderComponent: StatusBadgeComponent,
					componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
						instance.value = cell.getRawValue();
					}
				}
			}
		};
	}

	/**
	 * Determines whether the "Approved" button for equipment sharing should be shown.
	 *
	 * @param equipmentSharing - The equipment sharing to check.
	 * @returns True if the "Approved" button should be shown, false otherwise.
	 */
	showApprovedButton(equipmentSharing: IEquipmentSharing): boolean {
		// Check if equipmentSharing is truthy and has a valid status
		if (equipmentSharing && equipmentSharing.status) {
			const validStatuses: RequestApprovalStatusTypesEnum[] = [
				RequestApprovalStatusTypesEnum.REFUSED,
				RequestApprovalStatusTypesEnum.REQUESTED
			];

			// Return true if the status is included in the valid statuses
			return validStatuses.includes(equipmentSharing.status);
		}

		// Return false if equipmentSharing is falsy or has an invalid status
		return false;
	}

	/**
	 * Determines whether the "Refuse" button for equipment sharing should be shown.
	 *
	 * @param equipmentSharing - The equipment sharing to check.
	 * @returns True if the "Refuse" button should be shown, false otherwise.
	 */
	showRefuseButton(equipmentSharing: IEquipmentSharing): boolean {
		// Check if equipmentSharing is truthy and has a valid status
		if (equipmentSharing && equipmentSharing.status) {
			const validStatuses: RequestApprovalStatusTypesEnum[] = [
				RequestApprovalStatusTypesEnum.APPROVED,
				RequestApprovalStatusTypesEnum.REQUESTED
			];

			// Return true if the status is included in the valid statuses
			return validStatuses.includes(equipmentSharing.status);
		}

		// Return false if equipmentSharing is falsy or has an invalid status
		return false;
	}

	/**
	 * Approves the specified equipment sharing.
	 * Checks if the organization exists and if the approve button should be shown.
	 * If conditions are met, sends an approval request to the service and displays a success message.
	 * Finally, triggers a refresh of data and updates the equipment sharing observable.
	 * @param equipmentSharing - The equipment sharing to be approved.
	 */
	async approval(equipmentSharing: IEquipmentSharing): Promise<void> {
		// Check if the organization exists
		if (!this.organization) {
			return;
		}

		try {
			// Check if the approve button should be shown for the equipment sharing
			if (this.showApprovedButton(equipmentSharing)) {
				// Send an approval request to the service
				const request = await this.equipmentSharingService.approval(equipmentSharing.id);

				// If the approval is successful, display a success message
				if (request) {
					this.toastrService.success('EQUIPMENT_SHARING_PAGE.APPROVAL_SUCCESS', {
						name: equipmentSharing.name
					});
				}
			}
		} catch (error) {
			// Handle any errors that occur during the approval process
			this.errorHandlingService.handleError(error);
		} finally {
			// Trigger a refresh of data and update the equipment sharing observable
			this._refresh$.next(true);
			this.equipmentSharing$.next(true);
		}
	}

	/**
	 * Refuses the specified equipment sharing.
	 * Checks if the organization exists and if the refuse button should be shown.
	 * If conditions are met, sends a refusal request to the service and displays a success message.
	 * Finally, triggers a refresh of data and updates the equipment sharing observable.
	 * @param equipmentSharing - The equipment sharing to be refused.
	 */
	async refuse(equipmentSharing: IEquipmentSharing): Promise<void> {
		// Check if the organization exists
		if (!this.organization) {
			return;
		}

		try {
			// Check if the refuse button should be shown for the equipment sharing
			if (this.showRefuseButton(equipmentSharing)) {
				// Send a refusal request to the service
				const request = await this.equipmentSharingService.refuse(equipmentSharing.id);

				// If the refusal is successful, display a success message
				if (request) {
					this.toastrService.success('EQUIPMENT_SHARING_PAGE.APPROVAL_SUCCESS', {
						name: equipmentSharing.name
					});
				}
			}
		} catch (error) {
			// Handle any errors that occur during the saving process
			this.errorHandlingService.handleError(error);
		} finally {
			// Trigger a refresh of data and update the equipment sharing observable
			this._refresh$.next(true);
			this.equipmentSharing$.next(true);
		}
	}

	/**
	 * Saves the equipment sharing data.
	 * If isCreate is true, it opens a dialog for creating a new equipment sharing.
	 * If selectedItem is provided, it selects the equipment sharing for editing.
	 * After the dialog is closed, it displays a success message if the equipment sharing is saved.
	 * Finally, it triggers a refresh of data and updates the equipment sharing observable.
	 * @param isCreate - A boolean indicating whether to create a new equipment sharing.
	 * @param selectedItem - The equipment sharing to be edited.
	 */
	async save(isCreate: boolean, selectedItem?: IEquipmentSharing): Promise<void> {
		// If selectedItem is provided, select the equipment sharing
		if (selectedItem) {
			this.selectEquipmentSharing({
				isSelected: true,
				data: selectedItem
			});
		}

		try {
			let dialog;

			// Open a dialog for creating or editing equipment sharing
			if (!isCreate) {
				dialog = this.dialogService.open(EquipmentSharingMutationComponent, {
					context: {
						equipmentSharing: this.selectedEquipmentSharing
					}
				});
			} else {
				dialog = this.dialogService.open(EquipmentSharingMutationComponent);
			}

			// Wait for the dialog to close and get the equipment sharing data
			const equipmentSharing = await firstValueFrom(dialog.onClose);

			// If equipment sharing is saved, display a success message
			if (equipmentSharing) {
				this.toastrService.success('EQUIPMENT_SHARING_PAGE.REQUEST_SAVED');
			}
		} catch (error) {
			// Handle any errors that occur during the saving process
			this.errorHandlingService.handleError(error);
		} finally {
			// Trigger a refresh of data and update the equipment sharing observable
			this._refresh$.next(true);
			this.equipmentSharing$.next(true);
		}
	}

	/**
	 * Deletes the selected equipment sharing.
	 * If a selectedItem is provided, it selects the equipment sharing and opens a confirmation dialog.
	 * If the user confirms the deletion, the equipment sharing is deleted, and a success message is displayed.
	 * Finally, it triggers a refresh of data and updates the equipment sharing observable.
	 * @param selectedItem - The equipment sharing to be deleted.
	 */
	async delete(selectedItem?: IEquipmentSharing): Promise<void> {
		// If a selectedItem is provided, select the equipment sharing
		if (selectedItem) {
			this.selectEquipmentSharing({
				isSelected: true,
				data: selectedItem
			});
		}

		try {
			// Open a confirmation dialog and await the result
			const result = await firstValueFrom(this.dialogService.open(DeleteConfirmationComponent).onClose);

			// If the user confirms the deletion, proceed with the deletion
			if (result) {
				await this.equipmentSharingService.delete(this.selectedEquipmentSharing.id);
				// Display a success message
				this.toastrService.success('EQUIPMENT_SHARING_PAGE.REQUEST_DELETED');
			}
		} catch (error) {
			// Handle any errors that occur during the saving process
			this.errorHandlingService.handleError(error);
		} finally {
			// Trigger a refresh of data and update the equipment sharing observable
			this._refresh$.next(true);
			this.equipmentSharing$.next(true);
		}
	}

	/**
	 * Handles the selection of equipment sharing.
	 * Updates the selectedEquipmentSharing property based on the provided isSelected and data parameters.
	 * @param isSelected - A boolean indicating whether the equipment sharing is selected.
	 * @param data - The equipment sharing data.
	 */
	async selectEquipmentSharing({ isSelected, data }: ISelectedEquipmentSharing): Promise<void> {
		// Update the disableButton property based on the selection status
		this.disableButton = !isSelected;

		// Update the selectedEquipmentSharing property if the equipment sharing is selected, otherwise set it to null
		this.selectedEquipmentSharing = isSelected ? data : null;
	}

	/**
	 * Registers and configures the Smart Table source for equipment sharing.
	 * Sets up the ServerDataSource with relevant parameters, including the endpoint, where clause, and result mapping.
	 * Updates pagination and loading state accordingly.
	 */
	setSmartTableSource(): void {
		// Check if organization context is available
		if (!this.organization) {
			return;
		}

		// Set loading state to true while fetching data
		this.loading = true;

		// Destructure properties for clarity
		const { id: organizationId, tenantId } = this.organization;

		// Prepare request object with organization and tenant details
		const request: any = { organizationId, tenantId };

		// Add selected employee ID to the request if available
		if (this.selectedEmployeeId) {
			request.employeeId = this.selectedEmployeeId;
		}

		// Create a new ServerDataSource for Smart Table
		this.smartTableSource = new ServerDataSource(this.http, {
			endPoint: `${API_PREFIX}/equipment-sharing/pagination`,
			where: {
				...request,
				...(this.selectedEmployeeId ? { employeeIds: [this.selectedEmployeeId] } : {}),
				...this.filters.where
			},
			resultMap: (sharing: IEquipmentSharing) => ({
				...sharing,
				sharingStatus: this.statusMapper(sharing),
				name: sharing.equipment ? sharing.equipment.name : sharing.name
			}),
			// Finalize callback to handle post-processing
			finalize: () => {
				// If the data layout style is cards grid, push data to the equipments array
				if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
					this.equipments.push(...this.smartTableSource.getData());
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
	}

	/**
	 * Fetches and displays equipment sharing data.
	 * Sets up the Smart Table source, configures pagination, and retrieves elements for the specified data layout style.
	 */
	async getEquipmentSharings(): Promise<void> {
		// Check if organization context is available
		if (!this.organization) {
			return;
		}

		try {
			// Set up the Smart Table source
			this.setSmartTableSource();

			// Get pagination details
			const { activePage, itemsPerPage } = this.getPagination();

			// Set paging for the Smart Table source
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			// If the data layout style is cards grid, retrieve elements
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this.smartTableSource.getElements();
			}
		} catch (error) {
			// Handle errors by displaying a danger toast
			this.toastrService.danger(error);
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
	clearItem() {
		this.selectEquipmentSharing({
			isSelected: false,
			data: null
		});
	}

	/**
	 * Maps equipment sharing status to display text, value, and badge class.
	 * @param row - The equipment sharing data.
	 * @returns An object containing text, value, and class properties.
	 */
	statusMapper(row: IEquipmentSharing): { text: string; value: number; class: string } {
		let value: string;
		let badgeClass: string;

		// Map status values to corresponding display text, value, and badge class
		switch (row.status) {
			case RequestApprovalStatusTypesEnum.APPROVED:
				value = EquipmentSharingStatusEnum.APPROVED;
				badgeClass = 'success';
				break;
			case RequestApprovalStatusTypesEnum.REFUSED:
				value = EquipmentSharingStatusEnum.REFUSED;
				badgeClass = 'danger';
				break;
			default:
				value = EquipmentSharingStatusEnum.REQUESTED;
				badgeClass = 'warning';
				break;
		}

		// Return an object with text, value, and class properties
		return {
			text: value,
			value: row.status,
			class: badgeClass
		};
	}
}

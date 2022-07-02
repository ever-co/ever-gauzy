import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
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
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { combineLatest, Subject, firstValueFrom } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { EquipmentSharingMutationComponent } from '../../@shared/equipment-sharing';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { IPaginationBase, PaginationFilterBaseComponent } from '../../@shared/pagination/pagination-filter-base.component';
import { StatusBadgeComponent } from '../../@shared/status-badge';
import { EquipmentSharingPolicyComponent } from './table-components';
import { EquipmentSharingService, Store, ToastrService } from '../../@core/services';
import { API_PREFIX, ComponentEnum } from '../../@core/constants';
import { ServerDataSource } from '../../@core/utils/smart-table';
import { DateViewComponent } from '../../@shared/table-components';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './equipment-sharing.component.html',
	styleUrls: ['./equipment-sharing.component.scss']
})
export class EquipmentSharingComponent extends PaginationFilterBaseComponent
	implements OnInit, OnDestroy {

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

	equipmentSharingTable: Ng2SmartTableComponent;
	@ViewChild('equipmentSharingTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.equipmentSharingTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		public readonly translateService: TranslateService,
		private readonly equipmentSharingService: EquipmentSharingService,
		private readonly dialogService: NbDialogService,
		private readonly http: HttpClient,
		private readonly toastrService: ToastrService,
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
					this.selectedEmployeeId = (user.employee) ?
													user.employee.id :
														(employee) ? employee.id : null;
				}),
				tap(() => this.refreshPagination()),
				tap(() => this.equipmentSharing$.next(true)),
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
				tap(() => this.equipmentSharing$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.equipmentSharingTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				name: {
					title: this.getTranslation(
						'EQUIPMENT_SHARING_PAGE.EQUIPMENT_NAME'
					),
					type: 'string'
				},
				equipmentSharingPolicy: {
					title: this.getTranslation(
						'EQUIPMENT_SHARING_PAGE.EQUIPMENT_SHARING_POLICY'
					),
					type: 'custom',
					renderComponent: EquipmentSharingPolicyComponent,
					filter: false
				},
				shareRequestDay: {
					title: this.getTranslation(
						'EQUIPMENT_SHARING_PAGE.SHARE_REQUEST_DATE'
					),
					type: 'custom',
					renderComponent: DateViewComponent,
					filter: false
				},
				shareStartDay: {
					title: this.getTranslation(
						'EQUIPMENT_SHARING_PAGE.SHARE_START_DATE'
					),
					type: 'custom',
					renderComponent: DateViewComponent,
					filter: false
				},
				shareEndDay: {
					title: this.getTranslation(
						'EQUIPMENT_SHARING_PAGE.SHARE_END_DATE'
					),
					type: 'custom',
					renderComponent: DateViewComponent,
					filter: false
				},
				createdByName: {
					title: this.getTranslation(
						'EQUIPMENT_SHARING_PAGE.CREATED_BY'
					),
					type: 'string'
				},
				sharingStatus: {
					title: this.getTranslation('EQUIPMENT_SHARING_PAGE.STATUS'),
					type: 'custom',
					width: '5%',
					renderComponent: StatusBadgeComponent,
					filter: false
				}
			}
		};
	}

	/**
	 * Show/Hide Equipment Sharing Approved Button
	 *
	 * @param equipement
	 * @returns
	 */
	showApprovedButton(equipementSharing: IEquipmentSharing) {
		if (equipementSharing) {
			const statues: RequestApprovalStatusTypesEnum[] = [
				RequestApprovalStatusTypesEnum.REFUSED,
				RequestApprovalStatusTypesEnum.REQUESTED
			]
			return statues.includes(equipementSharing.status);
		}
		return false;
	}

	/**
	 * Show/Hide Equipment Sharing Refuse Button
	 *
	 * @param equipement
	 * @returns
	 */
	showRefuseButton(equipementSharing: IEquipmentSharing) {
		if (equipementSharing) {
			const statues: RequestApprovalStatusTypesEnum[] = [
				RequestApprovalStatusTypesEnum.APPROVED,
				RequestApprovalStatusTypesEnum.REQUESTED
			]
			return statues.includes(equipementSharing.status);
		}
		return false;
	}

	async approval(equipementSharing: IEquipmentSharing) {
		if (!this.organization) {
			return;
		}
		try {
			if (this.showApprovedButton(equipementSharing)) {
				const request = await this.equipmentSharingService.approval(
					equipementSharing.id
				);
				if (request) {
					this.toastrService.success('EQUIPMENT_SHARING_PAGE.APPROVAL_SUCCESS', {
						name: equipementSharing.name
					});
				}
			}
		} catch (error) {

		} finally {
			this.equipmentSharing$.next(true);
		}
	}

	async refuse(equipementSharing: IEquipmentSharing) {
		if (!this.organization) {
			return;
		}
		try {
			if (this.showRefuseButton(equipementSharing)) {
				const request = await this.equipmentSharingService.refuse(
					equipementSharing.id
				);
				if (request) {
					this.toastrService.success('EQUIPMENT_SHARING_PAGE.APPROVAL_SUCCESS', {
						name: equipementSharing.name
					});
				}
			}
		} catch (error) {

		} finally {
			this.equipmentSharing$.next(true);
		}
	}

	async save(
		isCreate: boolean,
		selectedItem?: IEquipmentSharing
	) {
		if (selectedItem) {
			this.selectEquipmentSharing({
				isSelected: true,
				data: selectedItem
			});
		}
		try {
			let dialog;
			if (!isCreate) {
				dialog = this.dialogService.open(EquipmentSharingMutationComponent, {
					context: {
						equipmentSharing: this.selectedEquipmentSharing
					}
				});
			} else {
				dialog = this.dialogService.open(EquipmentSharingMutationComponent);
			}
			const equipmentSharing = await firstValueFrom(dialog.onClose);
			if (equipmentSharing) {
				this.toastrService.success('EQUIPMENT_SHARING_PAGE.REQUEST_SAVED');
			}
		} catch (error) {

		} finally {
			this.equipmentSharing$.next(true);
		}
	}

	async delete(selectedItem?: IEquipmentSharing) {
		if (selectedItem) {
			this.selectEquipmentSharing({
				isSelected: true,
				data: selectedItem
			});
		}
		try {
			const result = await firstValueFrom(
				this.dialogService.open(DeleteConfirmationComponent).onClose
			);
			if (result) {
				await this.equipmentSharingService.delete(this.selectedEquipmentSharing.id);
				this.toastrService.success('EQUIPMENT_SHARING_PAGE.REQUEST_DELETED');
			}
		} catch (error) {

		} finally {
			this.equipmentSharing$.next(true);
		}
	}

	async selectEquipmentSharing({
		isSelected,
		data
	}: ISelectedEquipmentSharing) {
		this.disableButton = !isSelected;
		this.selectedEquipmentSharing = isSelected ? data : null;
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

		const request = {};
		if (this.selectedEmployeeId) request['employeeId'] = this.selectedEmployeeId;

		this.smartTableSource = new ServerDataSource(this.http, {
			endPoint: `${API_PREFIX}/equipment-sharing/pagination`,
			where: {
				...{ organizationId, tenantId },
				... (this.selectedEmployeeId) ? { employeeIds: [this.selectedEmployeeId] } : {},
				...this.filters.where
			},
			resultMap: (sharing: IEquipmentSharing) => {
				return Object.assign({}, sharing, {
					sharingStatus: this.statusMapper(sharing),
					name: sharing.equipment
							? sharing.equipment.name
							: sharing.name
				});
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

	async getEquipmentSharings() {
		if (!this.organization) {
			return;
		}
		try {
			this.setSmartTableSource();

			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this.smartTableSource.getElements();
				this.equipments = this.smartTableSource.getData();
			}
		} catch (error) {
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
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.equipmentSharingTable && this.equipmentSharingTable.grid) {
			this.equipmentSharingTable.grid.dataSet['willSelect'] = 'false';
			this.equipmentSharingTable.grid.dataSet.deselectAll();
		}
	}

	statusMapper(row: IEquipmentSharing) {
		let value : string;
		let badgeClass: string;

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
		return {
			text: value,
			value: row.status,
			class: badgeClass
		};
	}
}

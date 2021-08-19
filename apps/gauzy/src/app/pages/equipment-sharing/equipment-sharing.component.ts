import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, NavigationEnd, RouterEvent } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import {
	IEquipmentSharing,
	ComponentLayoutStyleEnum,
	ISelectedEquipmentSharing,
	PermissionsEnum
} from '@gauzy/contracts';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { FormGroup } from '@angular/forms';
import { NbDialogService } from '@nebular/theme';
import { first, switchMap, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '../../@shared/language-base';
import { EquipmentSharingMutationComponent } from '../../@shared/equipment-sharing';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import {
	EquipmentSharingActionComponent,
	EquipmentSharingStatusComponent,
	EquipmentSharingPolicyComponent
} from './table-components';
import { EmployeesService, EquipmentSharingService, Store, ToastrService } from '../../@core/services';
import { combineLatest, Subject } from 'rxjs';
import { ComponentEnum } from '../../@core/constants';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './equipment-sharing.component.html',
	styleUrls: ['./equipment-sharing.component.scss']
})
export class EquipmentSharingComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	settingsSmartTable: object;
	loading: boolean;
	selectedEquipmentSharing: IEquipmentSharing;
	smartTableSource = new LocalDataSource();
	form: FormGroup;
	disableButton = true;
	selectedEmployeeUserId: string;
	ngDestroy$ = new Subject<void>();
	selectedOrgId: string;
	equipmentsData: IEquipmentSharing[];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;

	equipmentSharingTable: Ng2SmartTableComponent;
	@ViewChild('equipmentSharingTable') set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.equipmentSharingTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		public readonly translateService: TranslateService,
		private readonly equipmentSharingService: EquipmentSharingService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly employeesService: EmployeesService,
		private readonly store: Store,
		private readonly router: Router
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();

		combineLatest([
			this.store.user$,
			this.store.selectedEmployee$,
			this.store.selectedOrganization$
		])
			.pipe(
				untilDestroyed(this),
				switchMap(
					async ([currentUser, selectedEmployee, selectedOrg]) => {
						if (currentUser.employee) {
							this.selectedEmployeeUserId = currentUser.id;
						} else {
							if (!this.hasPermission) return;

							await this.loadEmployeeUser(selectedEmployee?.id);
							this.selectedOrgId = selectedOrg.id;
						}
					}
				)
			)
			.subscribe(() => {
				this.loadSettings();
			});

		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	setView() {
		this.viewComponentName = ComponentEnum.EQUIPMENT_SHARING;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
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

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
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
					type: 'date',
					valuePrepareFunction: this._formatDate
				},
				shareStartDay: {
					title: this.getTranslation(
						'EQUIPMENT_SHARING_PAGE.SHARE_START_DATE'
					),
					type: 'date',
					valuePrepareFunction: this._formatDate,
					filter: false
				},
				shareEndDay: {
					title: this.getTranslation(
						'EQUIPMENT_SHARING_PAGE.SHARE_END_DATE'
					),
					type: 'date',
					valuePrepareFunction: this._formatDate,
					filter: false
				},
				createdByName: {
					title: this.getTranslation(
						'EQUIPMENT_SHARING_PAGE.CREATED_BY'
					),
					type: 'string'
				},
				status: {
					title: this.getTranslation('EQUIPMENT_SHARING_PAGE.STATUS'),
					type: 'custom',
					renderComponent: EquipmentSharingStatusComponent,
					filter: false
				},
				actions: {
					title: this.getTranslation(
						'EQUIPMENT_SHARING_PAGE.ACTIONS'
					),
					type: 'custom',
					renderComponent: EquipmentSharingActionComponent,
					onComponentInitFunction: (instance) => {
						instance.updateResult
							.pipe(untilDestroyed(this))
							.subscribe((eventUpdate) => {
								this.handleEvent(eventUpdate);
							});
					},
					filter: false
				}
			}
		};
	}

	approval(rowData) {
		const params = {
			isApproval: true,
			data: rowData
		};
		this.handleEvent(params);
	}
	refuse(rowData) {
		const params = {
			isApproval: false,
			data: rowData
		};
		this.handleEvent(params);
	}

	async handleEvent(params) {
		if (params.isApproval) {
			const request = await this.equipmentSharingService.approval(
				params.data.id
			);
			if (request) {
				this.toastrService.success(
					'EQUIPMENT_SHARING_PAGE.APPROVAL_SUCCESS',
					{
						name: params.data.name
					}
				);
			}
		} else {
			const request = await this.equipmentSharingService.refuse(
				params.data.id
			);
			if (request) {
				this.toastrService.success(
					'EQUIPMENT_SHARING_PAGE.REFUSE_SUCCESS',
					{
						name: params.data.name
					}
				);
			}
		}
		this.loadSettings();
		this.clearItem();
	}

	async save(isCreate: boolean, selectedItem?: IEquipmentSharing) {
		let dialog;
		if (selectedItem) {
			this.selectEquipmentSharing({
				isSelected: true,
				data: selectedItem
			});
		}
		if (!isCreate) {
			dialog = this.dialogService.open(
				EquipmentSharingMutationComponent,
				{
					context: { equipmentSharing: this.selectedEquipmentSharing }
				}
			);
		} else {
			dialog = this.dialogService.open(EquipmentSharingMutationComponent);
		}

		const equipmentSharing = await dialog.onClose.pipe(first()).toPromise();
		if (equipmentSharing) {
			this.toastrService.success('EQUIPMENT_SHARING_PAGE.REQUEST_SAVED');
		}
		this.loadSettings();
		this.clearItem();
	}

	async delete(selectedItem?: IEquipmentSharing) {
		if (selectedItem) {
			this.selectEquipmentSharing({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.equipmentSharingService.delete(
				this.selectedEquipmentSharing.id
			);
			this.loadSettings();
			this.clearItem();
			this.toastrService.success(
				'EQUIPMENT_SHARING_PAGE.REQUEST_DELETED'
			);
		}
	}

	async selectEquipmentSharing({
		isSelected,
		data
	}: ISelectedEquipmentSharing) {
		this.disableButton = !isSelected;
		this.selectedEquipmentSharing = isSelected ? data : null;
	}

	async loadSettings() {
		this.loading = true;
		let equipmentItems = [];
		if (this.selectedEmployeeUserId) {
			equipmentItems = await this.equipmentSharingService.getByAuthorUserId(
				this.selectedEmployeeUserId
			);
		} else {
			if (this.selectedOrgId) {
				equipmentItems = await this.equipmentSharingService.getByOrganizationId(
					this.selectedOrgId
				);
			}
		}
		this.loading = false;
		this.equipmentsData = equipmentItems.map((equipmentSharing) => {
			return {
				...equipmentSharing,
				name: equipmentSharing.equipment
					? equipmentSharing.equipment.name
					: ''
			};
		});

		this.smartTableSource.load(this.equipmentsData);
	}

	_formatDate(date): string {
		if (date) {
			return new DatePipe('en').transform(date, 'dd/MM/yyyy');
		}

		return null;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
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

	ngOnDestroy() {}

	manageApprovalPolicy() {
		this.router.navigate(['/pages/organization/equipment-sharing-policy']);
	}

	hasPermission() {
		return this.store.hasPermission(
			PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW
		);
	}

	async loadEmployeeUser(employeeId: string) {
		this.selectedEmployeeUserId = null;

		if (!employeeId) return;

		await this.employeesService
			.getEmployeeById(employeeId, [])
			.then((res) => {
				if (res && res.userId) {
					this.selectedEmployeeUserId = res.userId;
				}
			})
			.catch((err) => {
				this.toastrService.danger('Could not load employee');
			});
	}
}

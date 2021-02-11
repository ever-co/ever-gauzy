import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import {
	IEquipmentSharing,
	IApprovalPolicy,
	ComponentLayoutStyleEnum,
	ISelectedEquipmentSharing,
	PermissionsEnum
} from '@gauzy/contracts';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { FormGroup } from '@angular/forms';
import { EquipmentSharingService } from '../../@core/services/equipment-sharing.service';
import { NbDialogService } from '@nebular/theme';
import { EquipmentSharingMutationComponent } from '../../@shared/equipment-sharing/equipment-sharing-mutation.component';
import { first, tap } from 'rxjs/operators';
import { DatePipe } from '@angular/common';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { EquipmentSharingActionComponent } from './table-components/equipment-sharing-action/equipment-sharing-action.component';
import { EquipmentSharingStatusComponent } from './table-components/equipment-sharing-status/equipment-sharing-status.component';
import { Store } from '../../@core/services/store.service';
import { combineLatest, of, Subject } from 'rxjs';
import { Router, NavigationEnd, RouterEvent } from '@angular/router';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { EquipmentSharingPolicyComponent } from './table-components/equipment-sharing-policy/equipment-sharing-policy.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../@core/services/toastr.service';
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
	approvalPolicies: IApprovalPolicy[] = [];
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
		readonly translateService: TranslateService,
		private equipmentSharingService: EquipmentSharingService,
		private dialogService: NbDialogService,
		private toastrService: ToastrService,
		private store: Store,
		private router: Router
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
				tap(([currentUser, selectedEmployee, selectedOrg]) => {
					if (currentUser.employee) {
						this.selectedEmployeeUserId = currentUser.id;
					} else {
						if (
							!this.store.hasPermission(
								PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW
							)
						)
							return;

						//tstodo get userId by employee id
						this.selectedEmployeeUserId = selectedEmployee.id;
						this.selectedOrgId = selectedOrg.id;
					}
				})
			)
			.subscribe((res) => {
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
		this.equipmentsData = equipmentItems;
		this.smartTableSource.load(equipmentItems);
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

	manageAppropvalPolicy() {
		this.router.navigate(['/pages/organization/equipment-sharing-policy']);
	}
}

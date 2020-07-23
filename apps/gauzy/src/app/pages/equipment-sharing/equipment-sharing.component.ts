import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import {
	EquipmentSharing,
	ApprovalPolicy,
	ComponentLayoutStyleEnum
} from '@gauzy/models';
import { LocalDataSource } from 'ng2-smart-table';
import { FormGroup } from '@angular/forms';
import { EquipmentSharingService } from '../../@core/services/equipment-sharing.service';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { EquipmentSharingMutationComponent } from '../../@shared/equipment-sharing/equipment-sharing-mutation.component';
import { takeUntil, first } from 'rxjs/operators';
import { DatePipe } from '@angular/common';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { EquipmentSharingActionComponent } from './table-components/equipment-sharing-action/equipment-sharing-action.component';
import { EquipmentSharingStatusComponent } from './table-components/equipment-sharing-status/equipment-sharing-status.component';
import { Store } from '../../@core/services/store.service';
import { Subject } from 'rxjs';
import { Router, NavigationEnd, RouterEvent } from '@angular/router';
import { ComponentEnum } from '../../@core/constants/layout.constants';

export interface SelectedEquipmentSharing {
	data: EquipmentSharing;
	isSelected: false;
}

@Component({
	templateUrl: './equipment-sharing.component.html',
	styleUrls: ['./equipment-sharing.component.scss']
})
export class EquipmentSharingComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading = true;
	selectedEquipmentSharing: EquipmentSharing;
	smartTableSource = new LocalDataSource();
	form: FormGroup;
	disableButton = true;
	selectedEmployeeId: string;
	ngDestroy$ = new Subject<void>();
	approvalPolicies: ApprovalPolicy[] = [];
	selectedOrgId: string;
	equipmentsData: EquipmentSharing[];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	private _ngDestroy$ = new Subject<void>();

	@ViewChild('equipmentSharingTable')
	equipmentSharingTable;

	constructor(
		readonly translateService: TranslateService,
		private equipmentSharingService: EquipmentSharingService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private store: Store,
		private router: Router
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.store.selectedEmployee$
			.pipe(takeUntil(this.ngDestroy$))
			.subscribe((employee) => {
				if (employee && employee.id) {
					this.selectedEmployeeId = employee.id;
					this.loadSettings();
				} else {
					this.selectedEmployeeId = undefined;
					this.loadSettings();
				}
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this.ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this.selectedOrgId = org.id;
					this.loadSettings();
				}
			});
		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.loadSettings();
	}

	setView() {
		this.viewComponentName = ComponentEnum.EQUIPMENT_SHARING;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
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
				approvalPolicy: {
					title: this.getTranslation(
						'EQUIPMENT_SHARING_PAGE.APPROVAL_POLICY'
					),
					type: 'function',
					valuePrepareFunction: (approvalPolicy: any) => {
						if (approvalPolicy && approvalPolicy.name) {
							return approvalPolicy.name;
						}
						return '-';
					}
				},
				shareRequestDay: {
					title: this.getTranslation(
						'EQUIPMENT_SHARING_PAGE.SHARE_REQUIEST_DATE'
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
				createdBy: {
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
						instance.updateResult.subscribe((eventUpdate) => {
							this.handleEvent(eventUpdate);
						});
					},
					filter: false
				}
			}
		};
	}

	async handleEvent(params) {
		if (params.isApproval) {
			const request = await this.equipmentSharingService.approval(
				params.data.id
			);
			if (request) {
				this.toastrService.primary(
					this.getTranslation(
						'EQUIPMENT_SHARING_PAGE.APPROVAL_SUCCESS'
					),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
			}
			this.loadSettings();
		} else {
			const request = await this.equipmentSharingService.refuse(
				params.data.id
			);
			if (request) {
				this.toastrService.primary(
					this.getTranslation(
						'EQUIPMENT_SHARING_PAGE.REFUSE_SUCCESS'
					),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
			}
			this.loadSettings();
		}
	}

	async save(isCreate: boolean, selectedItem?: EquipmentSharing) {
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

		this.disableButton = true;
		if (equipmentSharing) {
			this.toastrService.primary(
				this.getTranslation('EQUIPMENT_SHARING_PAGE.REQUEST_SAVED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.loadSettings();
	}

	async delete(selectedItem?: EquipmentSharing) {
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
			this.toastrService.primary(
				this.getTranslation('EQUIPMENT_SHARING_PAGE.REQUEST_DELETED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.disableButton = true;
	}

	async selectEquipmentSharing({ isSelected, data }) {
		const selectedEquipment = isSelected ? data : null;
		if (this.equipmentSharingTable) {
			this.equipmentSharingTable.grid.dataSet.willSelect = false;
		}
		this.disableButton = !isSelected;
		this.selectedEquipmentSharing = selectedEquipment;
	}

	async loadSettings() {
		this.selectedEquipmentSharing = null;
		let equipmentItems = [];
		if (this.selectedEmployeeId) {
			equipmentItems = await this.equipmentSharingService.getEmployee(
				this.selectedEmployeeId
			);
		} else {
			if (this.selectedOrgId) {
				equipmentItems = await this.equipmentSharingService.getOrganization(
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
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}

	ngOnDestroy() {
		this.ngDestroy$.next();
		this.ngDestroy$.complete();
	}

	manageAppropvalPolicy() {
		this.router.navigate(['/pages/organization/approval-policy']);
	}
}

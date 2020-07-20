import { Component, OnInit, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import {
	EquipmentSharing,
	Equipment,
	ComponentLayoutStyleEnum,
	RequestApprovalStatusTypesEnum
} from '@gauzy/models';
import { LocalDataSource } from 'ng2-smart-table';
import { FormGroup } from '@angular/forms';
import { EquipmentSharingService } from '../../@core/services/equipment-sharing.service';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { EquipmentSharingMutationComponent } from '../../@shared/equipment-sharing/equipment-sharing-mutation.component';
import { first, takeUntil } from 'rxjs/operators';
import { DatePipe } from '@angular/common';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { EquipmentSharingActionComponent } from './table-components/equipment-sharing-action/equipment-sharing-action.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { Store } from '../../@core/services/store.service';
import { Subject } from 'rxjs/internal/Subject';

@Component({
	templateUrl: './equipment-sharing.component.html',
	styleUrls: ['./equipment-sharing.component.scss']
})
export class EquipmentSharingComponent extends TranslationBaseComponent
	implements OnInit {
	settingsSmartTable: object;
	loading = true;
	selectedEquipmentSharing: EquipmentSharing;
	equipmentsData: EquipmentSharing[];
	smartTableSource = new LocalDataSource();
	form: FormGroup;
	disableButton = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	isApproval: Boolean = false;
	isRefuse: Boolean = false;
	private _ngDestroy$ = new Subject<void>();

	@ViewChild('equipmentSharingTable') equipmentSharingTable;

	constructor(
		readonly translateService: TranslateService,
		private equipmentSharingService: EquipmentSharingService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private router: Router,
		private store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.loadSettings();
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();

		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
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
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				equipment: {
					title: this.getTranslation(
						'EQUIPMENT_SHARING_PAGE.EQUIPMENT_NAME'
					),
					type: 'string',
					valuePrepareFunction: (equipment: Equipment) => {
						if (equipment) {
							return equipment.name;
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
				status: {
					title: this.getTranslation('EQUIPMENT_SHARING_PAGE.STATUS'),
					type: 'string',
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

	async save(selectedItem?: EquipmentSharing) {
		if (selectedItem) {
			this.selectEquipmentSharing({
				isSelected: true,
				data: selectedItem
			});
		}
		const dialog = this.dialogService.open(
			EquipmentSharingMutationComponent,
			{
				context: { equipmentSharing: this.selectedEquipmentSharing }
			}
		);

		const equipmentSharing = await dialog.onClose.pipe(first()).toPromise();

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
		const equipmentItems = await this.equipmentSharingService.getAll();
		this.loading = false;
		this.equipmentsData = equipmentItems;
		this.smartTableSource.load(equipmentItems);

		equipmentItems.map((rowData) => {
			if (rowData && rowData.status) {
				if (rowData.status === 1) {
					this.isApproval = true;
					this.isRefuse = true;
				} else {
					this.isApproval = false;
					this.isRefuse = false;
				}
			}
		});
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
}

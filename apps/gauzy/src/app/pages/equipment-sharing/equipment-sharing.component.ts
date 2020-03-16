import { Component, OnInit, ViewChild, Pipe } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { EquipmentSharing, Equipment } from '@gauzy/models';
import { LocalDataSource } from 'ng2-smart-table';
import { FormGroup } from '@angular/forms';
import { EquipmentSharingService } from '../../@core/services/equipment-sharing.service';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { EquipmentSharingMutationComponent } from '../../@shared/equipment-sharing/equipment-sharing-mutation.component';
import { first } from 'rxjs/operators';
import { DatePipe } from '@angular/common';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';

export interface SelectedEquipmentSharing {
	data: EquipmentSharing;
	isSelected: false;
}

@Component({
	templateUrl: './equipment-sharing.component.html',
	styleUrls: ['./equipment-sharing.component.scss']
})
export class EquipmentSharingComponent extends TranslationBaseComponent
	implements OnInit {
	settingsSmartTable: object;
	loading = true;
	selectedEquipmentSharing: EquipmentSharing;
	smartTableSource = new LocalDataSource();
	form: FormGroup;
	disableButton = true;

	@ViewChild('equipmentSharingTable', { static: false })
	equipmentSharingTable;

	constructor(
		readonly translateService: TranslateService,
		private equipmentSharingService: EquipmentSharingService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.loadSettings();
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
				}
			}
		};
	}

	async save() {
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

	async delete() {
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

	async selectEquipmentSharing($event: SelectedEquipmentSharing) {
		if ($event.isSelected) {
			this.selectedEquipmentSharing = $event.data;
			this.disableButton = false;
			this.equipmentSharingTable.grid.dataSet.willSelect = false;
		} else {
			this.disableButton = true;
		}
	}

	async loadSettings() {
		this.selectedEquipmentSharing = null;
		const equipmentItems = await this.equipmentSharingService.getAll();
		console.log(equipmentItems);
		this.loading = false;
		this.smartTableSource.load(equipmentItems);
	}

	_formatDate(date): string {
		if (date) {
			//todo
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

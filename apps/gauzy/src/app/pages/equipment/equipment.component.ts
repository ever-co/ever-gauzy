import { Component, OnInit, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { Equipment } from '@gauzy/models';
import { LocalDataSource } from 'ng2-smart-table';
import { FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { EquipmentService } from '../../@core/services/equipment.service';
import { EquipmentMutationComponent } from '../../@shared/equipment/equipment-mutation.component';
import { first } from 'rxjs/operators';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { AutoApproveComponent } from './auto-approve/auto-approve.component';
import { Router } from '@angular/router';
import { PictureNameTagsComponent } from '../../@shared/table-components/picture-name-tags/picture-name-tags.component';

export interface SelectedEquipment {
	data: Equipment;
	isSelected: false;
}

@Component({
	templateUrl: './equipment.component.html',
	styleUrls: ['./equipment.component.scss']
})
export class EquipmentComponent extends TranslationBaseComponent
	implements OnInit {
	settingsSmartTable: object;
	loading = true;
	selectedEquipment: Equipment;
	smartTableSource = new LocalDataSource();
	form: FormGroup;
	disableButton = true;
	tags: any;
	selectedTags: any;

	@ViewChild('equipmentTable') equipmentTable;

	ngOnInit(): void {
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.loadSettings();
	}

	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private equipmentService: EquipmentService,
		private toastrService: NbToastrService,
		private router: Router
	) {
		super(translateService);
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation('EQUIPMENT_PAGE.EQUIPMENT_NAME'),
					type: 'custom',
					renderComponent: PictureNameTagsComponent
				},
				type: {
					title: this.getTranslation('EQUIPMENT_PAGE.EQUIPMENT_TYPE'),
					type: 'string'
				},
				SN: {
					title: this.getTranslation('EQUIPMENT_PAGE.EQUIPMENT_SN'),
					type: 'string'
				},
				manufacturedYear: {
					title: this.getTranslation(
						'EQUIPMENT_PAGE.EQUIPMENT_MANUFACTURED_YEAR'
					),
					type: 'number',
					filter: false
				},
				initialCost: {
					title: this.getTranslation(
						'EQUIPMENT_PAGE.EQUIPMENT_INITIAL_COST'
					),
					type: 'number',
					filter: false
				},
				currency: {
					title: this.getTranslation(
						'EQUIPMENT_PAGE.EQUIPMENT_CURRENCY'
					),
					type: 'string',
					filter: false
				},
				maxSharePeriod: {
					title: this.getTranslation(
						'EQUIPMENT_PAGE.EQUIPMENT_MAX_SHARE_PERIOD'
					),
					type: 'number',
					filter: false
				},
				autoApproveShare: {
					title: this.getTranslation(
						'EQUIPMENT_PAGE.EQUIPMENT_AUTO_APPROVE'
					),
					type: 'custom',
					filter: false,
					renderComponent: AutoApproveComponent
				}
			}
		};
	}

	manageEquipmentSharing() {
		this.router.navigate(['/pages/organization/equipment-sharing']);
	}

	async save() {
		if (this.selectedEquipment) {
			this.selectedTags = this.selectedEquipment.tags;
		} else {
			this.selectedTags = [];
		}
		const dialog = this.dialogService.open(EquipmentMutationComponent, {
			context: {
				equipment: this.selectedEquipment,
				tags: this.selectedTags
			}
		});
		const equipment = await dialog.onClose.pipe(first()).toPromise();
		this.selectedEquipment = null;
		this.disableButton = true;

		if (equipment) {
			this.toastrService.primary(
				this.getTranslation('EQUIPMENT_PAGE.EQUIPMENT_SAVED'),
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
			await this.equipmentService.delete(this.selectedEquipment.id);
			this.loadSettings();
			this.toastrService.primary(
				this.getTranslation('EQUIPMENT_PAGE.EQUIPMENT_DELETED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.disableButton = true;
	}

	async loadSettings() {
		this.selectedEquipment = null;
		const { items } = await this.equipmentService.getAll();
		this.loading = false;
		this.smartTableSource.load(items);
	}

	async selectEquipment($event: SelectedEquipment) {
		if ($event.isSelected) {
			this.selectedEquipment = $event.data;
			this.disableButton = false;
			this.equipmentTable.grid.dataSet.willSelect = false;
		} else {
			this.disableButton = true;
		}
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}
}

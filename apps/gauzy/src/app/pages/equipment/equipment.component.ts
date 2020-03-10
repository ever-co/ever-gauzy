import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { Equipment } from '@gauzy/models';
import { LocalDataSource } from 'ng2-smart-table';
import { FormGroup } from '@angular/forms';
import { SelectedTag } from '../tags/tags.component';
import { TranslateService } from '@ngx-translate/core';
import {
	NbDialogConfig,
	NbDialogService,
	NbToastrService
} from '@nebular/theme';
import { EquipmentService } from '../../@core/services/equipment.service';
import { EquipmentMutationComponent } from '../../@shared/equipment/equipment-mutation.component';
import { first } from 'rxjs/operators';

export interface SelectedEquipment {
	data: Equipment;
	isSelected: false;
}

@Component({
	templateUrl: './equipment.component.html',
	styleUrls: ['./equipment.component.scss']
})
export class EquipmentComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading = true;
	selectedEquipment: Equipment;
	smartTableSource = new LocalDataSource();
	equipment: Equipment;
	form: FormGroup;
	//todo
	data: SelectedTag;
	disableButton = true;

	@ViewChild('equipmentTable', { static: false }) equipmentTable;

	ngOnDestroy(): void {
		// throw new Error("Method not implemented.");
	}

	ngOnInit(): void {
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.loadSettings();
	}

	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private equipmentService: EquipmentService,
		private toastrService: NbToastrService
	) {
		super(translateService);
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation('EQUIPMENT_PAGE.EQUIPMENT_NAME'),
					type: 'string'
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
					type: 'boolean',

					filter: false
				}
			}
		};
	}

	async add() {
		const dialog = this.dialogService.open(EquipmentMutationComponent, {
			context: {
				equipment: this.selectedEquipment
			}
		});
		const addData = await dialog.onClose.pipe(first()).toPromise();
		this.selectedEquipment = null;
		this.disableButton = true;

		if (addData) {
			this.toastrService.primary(
				this.getTranslation('TAGS_PAGE.TAGS_ADD_TAG'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.loadSettings();
	}

	async loadSettings() {
		this.selectedEquipment = null;
		//todo
		const { items } = await this.equipmentService.getAll();
		this.loading = false;
		this.smartTableSource.load(items);
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}
}

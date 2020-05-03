import { OnInit, Component } from '@angular/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Equipment, CurrenciesEnum, Tag } from '@gauzy/models';
import { NbDialogRef } from '@nebular/theme';
import { EquipmentService } from '../../@core/services/equipment.service';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../../@core/services/store.service';

@Component({
	selector: 'ngx-equipment-mutation',
	templateUrl: './equipment-mutation.component.html',
	styleUrls: ['./equipment-mutation.component.scss']
})
export class EquipmentMutationComponent extends TranslationBaseComponent
	implements OnInit {
	form: FormGroup;
	equipment: Equipment;
	currencies = Object.values(CurrenciesEnum);
	selectedCurrency;
	tags: Tag[] = [];
	selectedTags: any;

	constructor(
		public dialogRef: NbDialogRef<EquipmentMutationComponent>,
		private equipmentService: EquipmentService,
		private fb: FormBuilder,
		readonly translationService: TranslateService,
		readonly store: Store
	) {
		super(translationService);
	}

	ngOnInit(): void {
		this.selectedCurrency = this.store.selectedOrganization
			? this.store.selectedOrganization.currency
			: this.currencies[0];

		this.initializeForm();
		this.form.get('currency').disable();
	}

	async initializeForm() {
		this.form = this.fb.group({
			tags: [this.equipment ? this.equipment.tags : ''],
			name: [
				this.equipment ? this.equipment.name : '',
				Validators.required
			],
			type: [this.equipment ? this.equipment.type : ''],
			serialNumber: [this.equipment ? this.equipment.serialNumber : ''],
			manufacturedYear: [
				this.equipment ? this.equipment.manufacturedYear : null,
				[Validators.min(1000)]
			],
			initialCost: [
				this.equipment ? this.equipment.initialCost : null,
				[Validators.min(0)]
			],
			currency: [this.selectedCurrency, Validators.required],
			maxSharePeriod: [
				this.equipment ? this.equipment.maxSharePeriod : null
			],
			autoApproveShare: [
				this.equipment ? this.equipment.autoApproveShare : false
			],
			id: [this.equipment ? this.equipment.id : null]
		});
	}

	async saveEquipment() {
		if (!this.form.get('id').value) {
			delete this.form.value['id'];
		}
		const equipment = await this.equipmentService.save({
			...this.form.value,
			currency: this.selectedCurrency,
			tags: this.tags
		});
		this.closeDialog(equipment);
	}

	async closeDialog(equipment?: Equipment) {
		this.dialogRef.close(equipment);
	}
	selectedTagsEvent(ev) {
		this.tags = ev;
	}
}

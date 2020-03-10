import { OnInit, Component } from '@angular/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Equipment, CurrenciesEnum } from '@gauzy/models';
import { NbDialogRef } from '@nebular/theme';
import { EquipmentService } from '../../@core/services/equipment.service';
import { TranslateService } from '@ngx-translate/core';
import { OrganizationEditStore } from '../../@core/services/organization-edit-store.service';

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

	constructor(
		protected dialogRef: NbDialogRef<EquipmentMutationComponent>,
		private equipmentService: EquipmentService,
		private fb: FormBuilder,
		readonly translationService: TranslateService,
		readonly organizationService: OrganizationEditStore
	) {
		super(translationService);
	}

	ngOnInit(): void {
		this.initializeForm();
		// alert(this.organizationService.selectedOrganization$.value.currency)
	}

	async initializeForm() {
		this.form = this.fb.group({
			name: [
				this.equipment ? this.equipment.name : '',
				Validators.required
			],
			type: [
				this.equipment ? this.equipment.type : '',
				Validators.required
			],
			SN: [this.equipment ? this.equipment.SN : ''],
			manufacturedYear: [
				this.equipment ? this.equipment.manufacturedYear : '',
				Validators.required
			],
			initialCost: [
				this.equipment ? this.equipment.initialCost : '',
				Validators.required
			],
			currency: [],
			maxSharePeriod: [
				this.equipment ? this.equipment.maxSharePeriod : '',
				Validators.required
			],
			autoApproveShare: [
				this.equipment ? this.equipment.autoApproveShare : ''
			]
		});
	}

	async saveEquipment() {
		const equipment = await this.equipmentService.save(this.form.value);
		this.closeDialog(equipment);
	}

	async closeDialog(equipment?: Equipment) {
		this.dialogRef.close(equipment);
	}
}
